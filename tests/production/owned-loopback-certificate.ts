import {generateKeyPairSync,randomBytes,sign,X509Certificate} from 'node:crypto';
import assert from 'node:assert/strict';

// Ephemeral self-signed TLS fixture; no OS trust-store writes or committed private material.
const der=(tag:number,bytes:Uint8Array)=>{
 const length=bytes.length,encoded=length<128?Buffer.from([length]):length<256?Buffer.from([0x81,length]):Buffer.from([0x82,length>>8,length&255]);
 return Buffer.concat([Buffer.from([tag]),encoded,bytes]);
};
const sequence=(...parts:Uint8Array[])=>der(0x30,Buffer.concat(parts));
const oid=(hex:string)=>der(0x06,Buffer.from(hex,'hex'));
const utc=(date:Date)=>der(0x17,Buffer.from(date.toISOString().slice(2,19).replace(/[-:T]/g,'')+'Z'));
export function ownedLoopbackCertificate(){
 const keys=generateKeyPairSync('rsa',{modulusLength:2048});
 const algorithm=sequence(oid('2a864886f70d01010b'),der(0x05,Buffer.alloc(0)));
 const name=sequence(der(0x31,sequence(oid('550403'),der(0x0c,Buffer.from('Owned C.C. Lime loopback TLS fixture')))));
 const serial=randomBytes(16);serial[0]=1;
 const extensions=der(0xa3,sequence(
  sequence(oid('551d13'),der(0x01,Buffer.from([0xff])),der(0x04,sequence(der(0x01,Buffer.from([0xff]))))),
  sequence(oid('551d11'),der(0x04,sequence(der(0x87,Buffer.from([127,0,0,1]))))),
 ));
 const tbs=sequence(der(0xa0,der(0x02,Buffer.from([2]))),der(0x02,serial),algorithm,name,
  sequence(utc(new Date(Date.now()-60000)),utc(new Date(Date.now()+86400000))),name,
  keys.publicKey.export({type:'spki',format:'der'}),extensions);
 const cert=sequence(tbs,algorithm,der(0x03,Buffer.concat([Buffer.from([0]),sign('RSA-SHA256',tbs,keys.privateKey)])));
 const parsed=new X509Certificate(cert);assert.equal(parsed.ca,true);assert.equal(parsed.verify(keys.publicKey),true);assert.equal(parsed.checkIP('127.0.0.1'),'127.0.0.1');
 const certificate=['-----BEGIN CERTIFICATE-----',...(cert.toString('base64').match(/.{1,64}/g)??[]),'-----END CERTIFICATE-----',''].join('\n');
 return {certificate,privateKey:keys.privateKey.export({type:'pkcs8',format:'pem'})};
}
