import { db } from "@db";
import { deviceConfigurations } from "@db/schema";

async function registerDevice() {
  try {
    // Check if device already exists
    const existing = await db.query.deviceConfigurations.findFirst({
      where: (deviceConfigurations, { eq }) => eq(deviceConfigurations.deviceId, 'raspberry-pi-filine'),
    });

    if (existing) {
      console.log('Device already registered:', existing);
      return;
    }

    // Create device
    const [device] = await db
      .insert(deviceConfigurations)
      .values({
        deviceId: 'raspberry-pi-filine',
        name: 'Raspberry Pi FiLine',
        ipAddress: 'localhost',
        port: 5000,
        deviceType: 'raspberry_pi',
        authToken: 'local-dev-token-no-auth-required',
        status: 'online',
        settings: { encryptionEnabled: false },
      })
      .returning();

    console.log('Device registered successfully:', device);
  } catch (error) {
    console.error('Error registering device:', error);
  } finally {
    process.exit(0);
  }
}

registerDevice();
