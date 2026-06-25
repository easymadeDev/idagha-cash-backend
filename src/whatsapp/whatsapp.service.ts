import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WhatsappAuth, WhatsappAuthDocument } from './whatsapp-auth.schema';
import { useMongoAuthState } from './baileys-auth';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private sock: any = null;
  private ready = false;
  private qrCode: string | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  constructor(
    @InjectModel(WhatsappAuth.name) private authModel: Model<WhatsappAuthDocument>,
  ) {}

  async onModuleInit() {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      this.logger.log('WhatsApp disabled (set WHATSAPP_ENABLED=true to enable)');
      return;
    }
    await this.connect();
  }

  private async connect() {
    try {
      const {
        default: makeWASocket,
        DisconnectReason,
        fetchLatestBaileysVersion,
      } = await import('@whiskeysockets/baileys') as any;

      const qrcode = await import('qrcode');
      const { state, saveCreds } = await useMongoAuthState(this.authModel);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: {
          level: 'silent',
          trace: () => {}, debug: () => {}, info: () => {},
          warn: () => {}, error: () => {}, fatal: () => {},
          child: () => ({ level: 'silent', trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) }),
        } as any,
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.ready = false;
          try {
            this.qrCode = await qrcode.toDataURL(qr);
          } catch {
            this.qrCode = qr;
          }
          this.logger.log('WhatsApp QR code ready — scan via admin panel');
        }

        if (connection === 'open') {
          this.ready = true;
          this.qrCode = null;
          this.reconnectAttempts = 0;
          this.logger.log('✅ WhatsApp connected and ready');
        }

        if (connection === 'close') {
          this.ready = false;
          const code = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = code !== DisconnectReason.loggedOut;
          this.logger.warn(`WhatsApp disconnected (code ${code}), reconnect: ${shouldReconnect}`);
          if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(3000 * Math.pow(1.5, this.reconnectAttempts), 60000);
            this.logger.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            setTimeout(() => this.connect(), delay);
          } else if (code === DisconnectReason.loggedOut) {
            await this.authModel.deleteMany({}).exec();
            this.qrCode = null;
            this.logger.warn('WhatsApp logged out — cleared stored credentials');
          }
        }
      });
    } catch (err: any) {
      this.logger.error('WhatsApp init error: ' + err.message);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  getQr() {
    return this.qrCode;
  }

  private normalizeJid(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) digits = '234' + digits.slice(1);
    return digits + '@s.whatsapp.net';
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.ready || !this.sock) throw new Error('WhatsApp client is not ready.');
    const jid = this.normalizeJid(phone);
    await this.sock.sendMessage(jid, { text: message });
  }

  async sendImageMessage(phone: string, imagePath: string, caption: string): Promise<void> {
    if (!this.ready || !this.sock) throw new Error('WhatsApp client is not ready.');
    const fs = await import('fs');
    const path = await import('path');
    const jid = this.normalizeJid(phone);
    const image = fs.readFileSync(path.resolve(imagePath));
    await this.sock.sendMessage(jid, { image, caption });
  }
}
