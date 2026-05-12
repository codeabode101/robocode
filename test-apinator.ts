import { Apinator } from '@apinator/server';

const key = 'app_6f9eb36b9dd488e2fef9ddf0cee08a2d4db8026f';
const secret = 'a17b103e71dec9bdacc3584aab10ad53302b3c6618864dbb11f246a99fc83f1b';

async function test(host: string, appId: string, label: string) {
  const apinator = new Apinator({ appId, key, secret, cluster: 'us' });
  (apinator as any).host = host;
  try {
    await apinator.trigger({ name: 'test', channel: 'robocode-live', data: '{}' });
    console.log(`SUCCESS: ${label}`);
  } catch (e: any) {
    console.log(`FAIL (${label}): ${e.message}${e.status ? ` [${e.status}]` : ''}`);
  }
}

(async () => {
  const hosts = ['https://api-us.apinator.io', 'https://ws-us.apinator.io'];
  const ids = ['6f9eb36b9dd488e2fef9ddf0cee08a2d4db8026f', 'app_6f9eb36b9dd488e2fef9ddf0cee08a2d4db8026f'];
  for (const host of hosts) {
    for (const id of ids) {
      await test(host, id, `${host} / ${id}`);
    }
  }
})();
