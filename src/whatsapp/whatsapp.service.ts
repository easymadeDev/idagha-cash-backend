import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private sock: any = null;
  private ready = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 3000;
  private lastActivity = Date.now();
  private keepAliveInterval: NodeJS.Timeout | null = null;

  constructor() {}

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
        initAuthCreds,
        BufferJSON,
      } = await import('@whiskeysockets/baileys') as any;

      const { version } = await fetchLatestBaileysVersion();

      let creds = initAuthCreds();
      const keys = new Map();

      const inMemoryAuthState = {
        creds,
        keys: {
          get: (type: any, jids: any) => {
            const data: any = {};
            for (const jid of jids) {
              data[jid] = keys.get(jid);
            }
            return data;
          },
          set: (data: any) => {
            for (const [jid, value] of Object.entries(data)) {
              keys.set(jid, value);
            }
          },
        },
      };

      const saveCreds = () => {
        // In-memory only, no persistence
      };

      const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: inMemoryAuthState,
        logger: {
          level: 'silent',
          trace: () => {},
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          fatal: () => {},
          child: () => ({
            level: 'silent',
            trace: () => {},
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {},
            child: () => ({}),
          }),
        } as any,
      });

      this.sock = sock;

      sock.ev.on('creds.update', () => {
        saveCreds();
      });

      sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
          this.ready = true;
          this.reconnectAttempts = 0;
          this.lastActivity = Date.now();
          this.logger.log('✅ WhatsApp connected and ready');

          if (!this.keepAliveInterval) {
            this.startKeepAlive();
          }
        }

        if (connection === 'close') {
          this.ready = false;
          const code = lastDisconnect?.error?.output?.statusCode;

          if (code === DisconnectReason.loggedOut) {
            this.logger.warn('WhatsApp: Logged out manually');
            return;
          }

          this.logger.warn(`WhatsApp disconnected (code ${code}), attempting reconnect...`);

          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
            this.reconnectAttempts++;
            this.logger.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            setTimeout(() => this.connect(), delay);
          } else {
            this.logger.error('WhatsApp: Max reconnection attempts reached');
          }
        }

        if (qr) {
          this.ready = false;
          this.logger.log('📱 QR code generated — scan to connect');
        }
      });

      sock.ev.on('messages.upsert', () => {
        this.lastActivity = Date.now();
      });
    } catch (err: any) {
      this.logger.error(`WhatsApp connection error: ${err.message}`);
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), delay);
      }
    }
  }

  private startKeepAlive() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);

    this.keepAliveInterval = setInterval(() => {
      if (!this.ready || !this.sock) {
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
        return;
      }

      const timeSinceActivity = Date.now() - this.lastActivity;
      if (timeSinceActivity > 60000) {
        this.logger.debug('Keep-alive: No activity, checking connection...');
        this.lastActivity = Date.now();
      }
    }, 30000);
  }

  isReady(): boolean {
    return this.ready && !!this.sock;
  }

  getQr() {
    return null;
  }

  private normalizeJid(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) digits = '234' + digits.slice(1);
    if (!digits.startsWith('234')) digits = '234' + digits;
    return digits + '@s.whatsapp.net';
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.ready || !this.sock) {
      this.logger.warn(`WhatsApp not ready, skipping message to ${phone.slice(-4)}`);
      return;
    }

    try {
      const jid = this.normalizeJid(phone);
      await this.sock.sendMessage(jid, { text: message });
      this.lastActivity = Date.now();
      this.logger.log(`✓ WhatsApp sent to ${phone.slice(-4)}`);
    } catch (err: any) {
      this.logger.error(`WhatsApp send error: ${err.message}`);
      if (err.message.includes('ENOTCONN') || err.message.includes('socket hang up')) {
        this.ready = false;
        this.reconnectAttempts = 0;
        await this.connect();
      }
    }
  }

  async sendImageMessage(phone: string, imagePath: string, caption: string): Promise<void> {
    if (!this.ready || !this.sock) {
      this.logger.warn(`WhatsApp not ready, skipping image to ${phone.slice(-4)}`);
      return;
    }

    try {
      const fs = await import('fs');
      const path = await import('path');
      const jid = this.normalizeJid(phone);
      const image = fs.readFileSync(path.resolve(imagePath));
      await this.sock.sendMessage(jid, { image, caption });
      this.lastActivity = Date.now();
    } catch (err: any) {
      this.logger.error(`WhatsApp image error: ${err.message}`);
    }
  }
}
