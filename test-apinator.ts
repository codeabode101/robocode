import { Apinator } from '@apinator/server';

const appId = '0b20127b-18a4-4e3a-b158-584ee0c857f2';
const key = 'app_6f9eb36b9dd488e2fef9ddf0cee08a2d4db8026f';
const secret = '0a55f92018ede47e926cfea9fa1e6f9fca3e2b2a08061edd4eb53b9739c48584';

(async () => {
  const client = new Apinator({ appId, key, secret, cluster: 'us' });

  // Test trigger
  try {
    await client.trigger({ name: 'test', channel: 'private-robocode-live', data: '{}' });
    console.log('✅ trigger');
  } catch (e: any) {
    console.log(`❌ trigger: ${e.message}${e.status ? ` [${e.status}]` : ''}`);
  }

  // Test getChannels
  try {
    const channels = await client.getChannels('private-');
    console.log(`✅ getChannels: ${channels.length} channels`);
  } catch (e: any) {
    console.log(`❌ getChannels: ${e.message}${e.status ? ` [${e.status}]` : ''}`);
  }

  // Test auth
  try {
    const auth = client.authenticateChannel('test-socket-id', 'private-robocode-live');
    console.log('✅ authenticateChannel:', auth.auth.substring(0, 30) + '...');
  } catch (e: any) {
    console.log(`❌ authenticateChannel: ${e.message}`);
  }
})();
