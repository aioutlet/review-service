import mongoose from 'mongoose';

const reviewFlagSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
      required: true,
      index: true,
    },
    flaggedBy: {
      type: String,
      required: true,
      index: true,
    },
    flaggedByName: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'fake', 'offensive', 'copyright', 'misleading', 'other'],
      required: true,
      index: true,
    },
    description: {
      type: String,
      maxlength: [500, 'Flag description cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },
    evidence: {
      screenshots: [
        {
          url: String,
          description: String,
        },
      ],
      links: [
        {
          url: String,
          description: String,
        },
      ],
      additionalInfo: String,
    },
    moderationActions: [
      {
        moderatorId: {
          type: String,
          required: true,
        },
        moderatorName: {
          type: String,
          required: true,
        },
        action: {
          type: String,
          enum: ['review_started', 'evidence_requested', 'under_investigation', 'resolved', 'dismissed', 'escalated'],
          required: true,
        },
        notes: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    resolution: {
      action: {
        type: String,
        enum: ['no_action', 'review_hidden', 'review_deleted', 'user_warned', 'user_suspended', 'content_edited'],
      },
      reason: String,
      moderatorId: String,
      moderatorName: String,
      resolvedAt: Date,
      notificationSent: {
        type: Boolean,
        default: false,
      },
    },
    metadata: {
      flaggedAt: {
        type: Date,
        default: Date.now,
        index: true,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      ipAddress: String,
      userAgent: String,
      source: {
        type: String,
        enum: ['web', 'mobile', 'api', 'automated'],
        default: 'web',
      },
      automated: {
        type: Boolean,
        default: false,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
      },
    },
  },
  {
    timestamps: { createdAt: 'metadata.flaggedAt', updatedAt: 'metadata.updatedAt' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
reviewFlagSchema.index({ reviewId: 1, flaggedBy: 1 }, { unique: true }); // Prevent duplicate flags from same user
reviewFlagSchema.index({ status: 1, priority: 1, 'metadata.flaggedAt': -1 });
reviewFlagSchema.index({ reason: 1, status: 1 });
reviewFlagSchema.index({ 'metadata.automated': 1, 'metadata.confidence': -1 });

// Virtual for flag age in hours
reviewFlagSchema.virtual('ageInHours').get(function () {
  return Math.floor((Date.now() - this.metadata.flaggedAt) / (1000 * 60 * 60));
});

// Virtual for resolution time in hours
reviewFlagSchema.virtual('resolutionTimeHours').get(function () {
  if (!this.resolution.resolvedAt) return null;
  return Math.floor((this.resolution.resolvedAt - this.metadata.flaggedAt) / (1000 * 60 * 60));
});

// Virtual for escalation needed
reviewFlagSchema.virtual('needsEscalation').get(function () {
  const hoursOld = this.ageInHours;
  const isHighPriority = ['high', 'critical'].includes(this.priority);
  const isPending = this.status === 'pending';

  return isPending && ((isHighPriority && hoursOld > 2) || hoursOld > 24);
});

// Static method to get flag statistics
reviewFlagSchema.statics.getStats = async function (dateRange = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);

  const pipeline = [
    { $match: { 'metadata.flaggedAt': { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalFlags: { $sum: 1 },
        byReason: {
          $push: '$reason',
        },
        byStatus: {
          $push: '$status',
        },
        byPriority: {
          $push: '$priority',
        },
        averageResolutionTime: {
          $avg: {
            $cond: [
              { $ne: ['$resolution.resolvedAt', null] },
              { $subtract: ['$resolution.resolvedAt', '$metadata.flaggedAt'] },
              null,
            ],
          },
        },
        automatedFlags: {
          $sum: { $cond: ['$metadata.automated', 1, 0] },
        },
      },
    },
  ];

  const [result] = await this.aggregate(pipeline);

  if (!result) {
    return {
      totalFlags: 0,
      byReason: {},
      byStatus: {},
      byPriority: {},
      averageResolutionTime: 0,
      automatedFlags: 0,
    };
  }

  // Process arrays into count objects
  const processArray = (arr) => {
    return arr.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
  };

  return {
    totalFlags: result.totalFlags,
    byReason: processArray(result.byReason),
    byStatus: processArray(result.byStatus),
    byPriority: processArray(result.byPriority),
    averageResolutionTime: result.averageResolutionTime
      ? Math.round(result.averageResolutionTime / (1000 * 60 * 60))
      : 0, // Convert to hours
    automatedFlags: result.automatedFlags,
  };
};

// Instance method to add moderation action
reviewFlagSchema.methods.addModerationAction = function (moderatorId, moderatorName, action, notes = '') {
  this.moderationActions.push({
    moderatorId,
    moderatorName,
    action,
    notes,
    timestamp: new Date(),
  });

  // Update status based on action
  const statusMap = {
    review_started: 'under_review',
    evidence_requested: 'under_review',
    under_investigation: 'under_review',
    resolved: 'resolved',
    dismissed: 'dismissed',
    escalated: 'under_review',
  };

  if (statusMap[action]) {
    this.status = statusMap[action];
  }

  this.metadata.updatedAt = new Date();
};

// Instance method to resolve flag
reviewFlagSchema.methods.resolve = function (action, reason, moderatorId, moderatorName) {
  this.resolution = {
    action,
    reason,
    moderatorId,
    moderatorName,
    resolvedAt: new Date(),
    notificationSent: false,
  };

  this.status = 'resolved';
  this.metadata.updatedAt = new Date();
};

// Pre-save middleware
reviewFlagSchema.pre('save', function (next) {
  this.metadata.updatedAt = new Date();
  next();
});

export default mongoose.model('ReviewFlag', reviewFlagSchema);
