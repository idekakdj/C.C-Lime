// Owned loopback fixture. Run in a child so a parser CPU regression is killable.
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = createRequire(require.resolve('firebase-tools'));
const proxy = createRequire(cli.resolve('proxy-agent'));
const pac = createRequire(proxy.resolve('pac-proxy-agent'));
const uri = createRequire(pac.resolve('get-uri'));
const { getUri } = pac('get-uri');
const { Client } = uri('basic-ftp');
assert.equal(uri('basic-ftp/package.json').version, '6.2.1');

const scenario = process.argv[2];
assert.ok(['download', 'fallback', 'malformed', 'cache', 'missing'].includes(scenario));
const content = 'function FindProxyForURL() { return "DIRECT"; }\n';
const commands = [], sockets = new Set(), servers = new Set();
const control = net.createServer(socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => {});
  socket.setEncoding('utf8');
  socket.write('220 C.C. Lime isolated FTP fixture\r\n');
  let buffer = '', dataSocket, dataReady;
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const verb = line.split(' ')[0];
      commands.push(verb);
      if (verb === 'USER') socket.write('331 Password required\r\n');
      else if (verb === 'PASS') socket.write('230 Logged in\r\n');
      else if (verb === 'FEAT') socket.write('211 End\r\n');
      else if (verb === 'MDTM') socket.write(scenario === 'missing' ? '550 Missing\r\n' : scenario === 'fallback' ? '500 Unsupported\r\n' : '213 20200101000000\r\n');
      else if (verb === 'EPSV') {
        const data = net.createServer(connection => {
          dataSocket = connection;
          sockets.add(connection);
          connection.on('close', () => sockets.delete(connection));
          connection.on('error', () => {});
          data.close();
          dataReady();
        });
        servers.add(data);
        dataSocket = undefined;
        dataReady = undefined;
        socket.fixtureData = new Promise(resolve => { dataReady = resolve; });
        data.listen(0, '127.0.0.1', () => socket.write(`229 Entering passive mode (|||${data.address().port}|)\r\n`));
      } else if (['RETR', 'LIST', 'MLSD'].includes(verb)) {
        socket.write('150 Data follows\r\n');
        void socket.fixtureData.then(() => {
          const body = verb === 'RETR' ? content : scenario === 'malformed'
            ? `-rw-r--r-- 1 ${'word '.repeat(14000)}!\r\n-rw-r--r-- 1 owner group 42 Jan 1 2020 fixture.pac\r\n`
            : 'type=file;size=47;modify=20200101000000; fixture.pac\r\n';
          dataSocket.end(body, () => socket.write('226 Transfer complete\r\n'));
        });
      } else if (verb === 'QUIT') socket.end('221 Bye\r\n');
      else socket.write('200 OK\r\n');
    }
  });
});
servers.add(control);
let client;
try {
  control.listen(0, '127.0.0.1');
  await once(control, 'listening');
  const url = `ftp://fixture:synthetic@127.0.0.1:${control.address().port}/fixture.pac`;
  if (scenario === 'malformed') {
    client = new Client(3000);
    await client.access({ host: '127.0.0.1', port: control.address().port, user: 'fixture', password: 'synthetic' });
    const listing = await client.list();
    assert.equal(listing.length, 1);
    assert.equal(listing[0].name, 'fixture.pac');
    assert.equal(listing[0].size, 42);
    assert.ok(commands.includes('LIST'));
  } else if (scenario === 'cache' || scenario === 'missing') {
    await assert.rejects(getUri(url, scenario === 'cache' ? { cache: { lastModified: new Date('2020-01-01T00:00:00Z') } } : {}), { code: scenario === 'cache' ? 'ENOTMODIFIED' : 'ENOTFOUND' });
    assert.ok(!commands.includes('RETR'));
  } else {
    const stream = await getUri(url);
    let downloaded = '';
    for await (const chunk of stream) downloaded += chunk.toString();
    assert.equal(downloaded, content);
    assert.equal(stream.lastModified.toISOString(), '2020-01-01T00:00:00.000Z');
    assert.ok(commands.includes('RETR'));
    if (scenario === 'fallback') assert.ok(commands.includes('LIST'));
    else assert.ok(!commands.includes('LIST'));
  }
} finally {
  client?.close();
  for (const socket of sockets) socket.destroy();
  await Promise.all([...servers].map(server => new Promise(resolve => server.close(() => resolve()))));
}
console.log(JSON.stringify({ scenario, closed: true }));
