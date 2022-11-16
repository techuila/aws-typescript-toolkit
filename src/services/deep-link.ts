import https from 'https';

type DeepLinkInput<T> = { [K in keyof T]: T[K] };
type DeepLinkOutput = { url: string };

export async function createDeepLink<T>(data: DeepLinkInput<T>, branchKey: string): Promise<DeepLinkOutput> {
  const body = JSON.stringify({
    data,
    branch_key: branchKey,
    type: 1
  });
  const options = {
    hostname: 'api.branch.io',
    path: '/v1/url',
    port: 443,
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const result = (await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        resolve(JSON.parse(body));
      });
    });

    req.on('error', (err) => reject(err));

    req.write(body);
    req.end();
  })) as DeepLinkOutput;

  return result;
}
