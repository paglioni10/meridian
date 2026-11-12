import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./", import.meta.url));

const accountCsv = [
  "Data,Valor,Identificador,Descrição",
  "01/11/2026,5200.00,6a1f0c00-0000-4000-8000-000000000001,Transferência recebida pelo Pix - EMPRESA X LTDA",
  "03/11/2026,-1500.00,6a1f0c00-0000-4000-8000-000000000002,Transferência enviada pelo Pix - IMOBILIARIA LAR",
  "05/11/2026,-23.90,6a1f0c00-0000-4000-8000-000000000003,Compra no débito - PADARIA PÃO QUENTE",
  "05/11/2026,-23.90,6a1f0c00-0000-4000-8000-000000000004,Compra no débito - PADARIA PÃO QUENTE",
  "10/11/2026,-1830.45,6a1f0c00-0000-4000-8000-000000000005,Pagamento de fatura",
  "12/11/2026,-500.00,6a1f0c00-0000-4000-8000-000000000006,Aplicação RDB",
  '15/11/2026,-89.90,6a1f0c00-0000-4000-8000-000000000007,"Pagamento de boleto efetuado - HETZNER ONLINE, GMBH"',
  "data inválida,-1.00,x,linha quebrada",
].join("\n");

const cardCsv = [
  "date,title,amount",
  "2026-11-02,Ifood *Restaurante Sabor,58.40",
  "2026-11-04,Uber *Trip,23.15",
  "2026-11-06,Netflix.Com,55.90",
  "2026-11-08,Supermercado Bom Preço - Parcela 1/3,210.00",
  "2026-11-10,Pagamento recebido,-1830.45",
  "2026-11-11,Estorno - Uber *Trip,-23.15",
].join("\r\n");

const accountOfx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261120000000[-3:BRT]<LANGUAGE>POR</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>BRL
<BANKTRANLIST>
<DTSTART>20261101000000[-3:BRT]
<DTEND>20261120000000[-3:BRT]
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261101000000[-3:BRT]
<TRNAMT>5200.00
<FITID>6a1f0c00-0000-4000-8000-000000000001
<MEMO>Transferência recebida pelo Pix - EMPRESA X LTDA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105000000[-3:BRT]
<TRNAMT>-23.90
<FITID>6a1f0c00-0000-4000-8000-000000000003
<MEMO>Compra no débito - PADARIA PÃO QUENTE &amp; CIA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261131000000[-3:BRT]
<TRNAMT>-1.00
<FITID>invalida
<MEMO>Data inexistente
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const cardOfx = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="211" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20261102</DTPOSTED>
<TRNAMT>-58.40</TRNAMT>
<FITID>card-0001</FITID>
<MEMO>Ifood *Restaurante Sabor</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20261110</DTPOSTED>
<TRNAMT>1830.45</TRNAMT>
<FITID>card-0002</FITID>
<MEMO>Pagamento recebido</MEMO>
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>
`;

writeFileSync(
  `${dir}nubank-conta.csv`,
  Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(accountCsv, "utf8")]),
);
writeFileSync(`${dir}nubank-cartao.csv`, cardCsv, "utf8");
writeFileSync(`${dir}nubank-conta.ofx`, Buffer.from(accountOfx, "latin1"));
writeFileSync(`${dir}nubank-cartao.ofx`, cardOfx, "utf8");
