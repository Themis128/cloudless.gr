import { defineEventHandler } from 'h3';

/**
 * API endpoint to fetch recent activity/events for the dashboard
 * This provides a feed of recent actions, deployments, errors, etc.
 */
export default defineEventHandler(async (event) => {
  try {
    // TODO: Replace with actual database queries when activity logging is implemented
    // For now, return mock data for development
    
    const activities = [
      {
        id: 1,
        title: 'New agent "Customer Support Bot" created',
        description: 'An AI agent for handling customer inquiries was successfully deployed',
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutes ago
        type: 'agent_created',
        icon: 'mdi-robot',
        color: 'success'
      },
      {
        id: 2,
        title: 'Workflow "Data Processing Pipeline" executed',
        description: 'Processed 1,247 records in 3.2 seconds',
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutes ago
        type: 'workflow_executed',
        icon: 'mdi-graph-outline',
        color: 'info'
      },
      {
        id: 3,
        title: 'System maintenance completed',
        description: 'Database optimization and cache cleanup finished successfully',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        type: 'maintenance',
        icon: 'mdi-wrench',
        color: 'warning'
      },
      {
        id: 4,
        title: 'API rate limit warning',
        description: 'Approaching daily API limit (85% used)',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
        type: 'warning',
        icon: 'mdi-alert',
        color: 'orange'
      },
      {
        id: 5,
        title: 'New user registration',
        description: 'User john.doe@example.com joined the platform',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
        type: 'user_registered',
        icon: 'mdi-account-plus',
        color: 'success'
      }
    ];

    return {
      success: true,
      data: activities,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    
    return {
      success: false,
      error: 'Failed to fetch recent activity',
      data: []
    };
  }
});
