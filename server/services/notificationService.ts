import fetch from "node-fetch";

interface NotificationConfig {
  discord?: {
    enabled: boolean;
    webhookUrl?: string;
  };
  telegram?: {
    enabled: boolean;
    botToken?: string;
    chatId?: string;
  };
}

interface CallNotification {
  phoneNumber: string;
  action: "blocked" | "allowed" | "challenge";
  reason: string;
  risk: number;
  timestamp: Date;
  callerName?: string;
  features?: string[];
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(config?: NotificationConfig) {
    this.config = config || {
      discord: {
        enabled: !!process.env.DISCORD_WEBHOOK_URL,
        webhookUrl: process.env.DISCORD_WEBHOOK_URL
      },
      telegram: {
        enabled: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
      }
    };
  }

  async notifyBlockedCall(notification: CallNotification): Promise<void> {
    const promises = [];

    if (this.config.discord?.enabled && this.config.discord.webhookUrl) {
      promises.push(this.sendDiscordNotification(notification));
    }

    if (this.config.telegram?.enabled && this.config.telegram.botToken) {
      promises.push(this.sendTelegramNotification(notification));
    }

    await Promise.allSettled(promises);
  }

  private async sendDiscordNotification(notification: CallNotification): Promise<void> {
    if (!this.config.discord?.webhookUrl) return;

    const embed = {
      title: `🛑 Call ${notification.action === "blocked" ? "Blocked" : "Challenged"}`,
      description: notification.reason,
      color: notification.action === "blocked" ? 0xff0000 : 0xffa500,
      fields: [
        {
          name: "Phone Number",
          value: notification.phoneNumber,
          inline: true
        },
        {
          name: "Risk Score",
          value: `${(notification.risk * 100).toFixed(1)}%`,
          inline: true
        },
        {
          name: "Time",
          value: notification.timestamp.toLocaleString(),
          inline: true
        }
      ],
      footer: {
        text: "FiLine Wall - The Firewall for Your Phone Line"
      },
      timestamp: notification.timestamp.toISOString()
    };

    if (notification.callerName) {
      embed.fields.unshift({
        name: "Caller Name",
        value: notification.callerName,
        inline: true
      });
    }

    if (notification.features && notification.features.length > 0) {
      embed.fields.push({
        name: "Detection Factors",
        value: notification.features.slice(0, 3).join("\n"),
        inline: false
      });
    }

    try {
      const response = await fetch(this.config.discord.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          embeds: [embed]
        })
      });

      if (!response.ok) {
        console.error("Failed to send Discord notification:", await response.text());
      }
    } catch (error) {
      console.error("Error sending Discord notification:", error);
    }
  }

  private async sendTelegramNotification(notification: CallNotification): Promise<void> {
    if (!this.config.telegram?.botToken || !this.config.telegram?.chatId) return;

    const actionEmoji = notification.action === "blocked" ? "🛑" : "⚠️";
    const riskPercent = (notification.risk * 100).toFixed(1);

    let message = `${actionEmoji} *Call ${notification.action === "blocked" ? "Blocked" : "Challenged"}*\n\n`;
    message += `📞 Number: \`${notification.phoneNumber}\`\n`;
    
    if (notification.callerName) {
      message += `👤 Name: ${notification.callerName}\n`;
    }
    
    message += `⚠️ Risk: ${riskPercent}%\n`;
    message += `📋 Reason: ${notification.reason}\n`;
    message += `🕐 Time: ${notification.timestamp.toLocaleString()}\n`;

    if (notification.features && notification.features.length > 0) {
      message += `\n🔍 Detected:\n`;
      notification.features.slice(0, 3).forEach(feature => {
        message += `  • ${feature}\n`;
      });
    }

    const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: this.config.telegram.chatId,
          text: message,
          parse_mode: "Markdown"
        })
      });

      if (!response.ok) {
        console.error("Failed to send Telegram notification:", await response.text());
      }
    } catch (error) {
      console.error("Error sending Telegram notification:", error);
    }
  }

  async notifySystemAlert(title: string, message: string, severity: "info" | "warning" | "error"): Promise<void> {
    const promises = [];

    if (this.config.discord?.enabled && this.config.discord.webhookUrl) {
      promises.push(this.sendDiscordAlert(title, message, severity));
    }

    if (this.config.telegram?.enabled && this.config.telegram.botToken) {
      promises.push(this.sendTelegramAlert(title, message, severity));
    }

    await Promise.allSettled(promises);
  }

  private async sendDiscordAlert(title: string, message: string, severity: "info" | "warning" | "error"): Promise<void> {
    if (!this.config.discord?.webhookUrl) return;

    const colors = {
      info: 0x3498db,
      warning: 0xf39c12,
      error: 0xe74c3c
    };

    const embed = {
      title,
      description: message,
      color: colors[severity],
      timestamp: new Date().toISOString(),
      footer: {
        text: "FiLine Wall System Alert"
      }
    };

    try {
      await fetch(this.config.discord.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          embeds: [embed]
        })
      });
    } catch (error) {
      console.error("Error sending Discord alert:", error);
    }
  }

  private async sendTelegramAlert(title: string, message: string, severity: "info" | "warning" | "error"): Promise<void> {
    if (!this.config.telegram?.botToken || !this.config.telegram?.chatId) return;

    const emoji = {
      info: "ℹ️",
      warning: "⚠️",
      error: "🚨"
    };

    const text = `${emoji[severity]} *${title}*\n\n${message}`;

    try {
      await fetch(`https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: this.config.telegram.chatId,
          text,
          parse_mode: "Markdown"
        })
      });
    } catch (error) {
      console.error("Error sending Telegram alert:", error);
    }
  }

  async testNotifications(): Promise<{ discord: boolean; telegram: boolean }> {
    const results = {
      discord: false,
      telegram: false
    };

    if (this.config.discord?.enabled) {
      try {
        await this.sendDiscordAlert(
          "Test Notification",
          "FiLine Wall notification system is working correctly!",
          "info"
        );
        results.discord = true;
      } catch (error) {
        console.error("Discord test failed:", error);
      }
    }

    if (this.config.telegram?.enabled) {
      try {
        await this.sendTelegramAlert(
          "Test Notification",
          "FiLine Wall notification system is working correctly!",
          "info"
        );
        results.telegram = true;
      } catch (error) {
        console.error("Telegram test failed:", error);
      }
    }

    return results;
  }
}

// Singleton instance
export const notificationService = new NotificationService();
