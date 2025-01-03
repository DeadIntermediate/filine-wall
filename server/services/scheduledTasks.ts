import { SpamDatabaseService } from "./spamDatabaseService";

export function initializeScheduledTasks() {
  // Refresh FCC database every 24 hours
  setInterval(async () => {
    try {
      await SpamDatabaseService.refreshDatabase();
      console.log("FCC spam database refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh FCC spam database:", error);
    }
  }, 24 * 60 * 60 * 1000); // 24 hours

  // Initial refresh
  SpamDatabaseService.refreshDatabase()
    .then(() => console.log("Initial FCC spam database refresh completed"))
    .catch(error => console.error("Initial FCC database refresh failed:", error));
}
