// This script runs in the edge container of a container site; container-site.ts copies it there and starts it.
// The edge forwards each connection from its published loopback port to the server container on the internal
// network. It is also the DNS server of each container on that network: it logs each query for a name outside
// the network and answers that the name does not exist. A container that tries an outbound connection by name
// thus leaves a line in the edge log, and the connection fails.
import { createSocket } from 'node:dgram';
import { connect, createServer, type Socket } from 'node:net';

const SERVER_ALIAS = 'magumagu';
const SERVER_PORT = 8080;
const DNS_PORT = 53;
const HEADER_LENGTH = 12;
const QUESTION_TYPE_AND_CLASS_LENGTH = 4;
const LABEL_POINTER = 0xc0;
// Byte 2 keeps the opcode and the recursion-desired flag of the query and sets the response flag.
const RESPONSE = 0x80;
const OPCODE_AND_RECURSION_DESIRED = 0x79;
// Byte 3 sets the recursion-available flag and the response code NXDOMAIN.
const RECURSION_AVAILABLE_NAME_ERROR = 0x83;

interface Question {
  readonly name: string;
  readonly type: number;
  readonly end: number;
}

function questionOf(message: Buffer): Question | undefined {
  const labels: string[] = [];
  let offset = HEADER_LENGTH;
  while (offset < message.length && message[offset] !== 0) {
    const length = message[offset] ?? 0;
    if ((length & LABEL_POINTER) !== 0) return undefined;
    labels.push(message.subarray(offset + 1, offset + 1 + length).toString('latin1'));
    offset += length + 1;
  }
  const end = offset + 1 + QUESTION_TYPE_AND_CLASS_LENGTH;
  if (end > message.length) return undefined;
  return { name: labels.join('.'), type: message.readUInt16BE(offset + 1), end };
}

function nameErrorAnswer(message: Buffer, question: Question): Buffer {
  const answer = Buffer.from(message.subarray(0, question.end));
  answer[2] = RESPONSE | ((message[2] ?? 0) & OPCODE_AND_RECURSION_DESIRED);
  answer[3] = RECURSION_AVAILABLE_NAME_ERROR;
  answer.writeUInt16BE(1, 4);
  for (const count of [6, 8, 10]) answer.writeUInt16BE(0, count);
  return answer;
}

function forward(client: Socket): void {
  const server = connect(SERVER_PORT, SERVER_ALIAS);
  const close = (): void => {
    client.destroy();
    server.destroy();
  };
  for (const socket of [client, server]) socket.on('error', close).on('close', close);
  client.pipe(server).pipe(client);
}

const dns = createSocket('udp4');
dns.on('message', (message, sender) => {
  const question = questionOf(message);
  if (question === undefined) {
    process.stdout.write('Outbound DNS query that the edge cannot read\n');
    return;
  }
  process.stdout.write(`Outbound DNS query for ${question.name} (type ${question.type})\n`);
  dns.send(nameErrorAnswer(message, question), sender.port, sender.address);
});

let listeners = 0;
const listening = (): void => {
  listeners += 1;
  if (listeners === 2) process.stdout.write('Edge ready\n');
};
dns.bind(DNS_PORT, '0.0.0.0', listening);
createServer(forward).listen(SERVER_PORT, '0.0.0.0', listening);
