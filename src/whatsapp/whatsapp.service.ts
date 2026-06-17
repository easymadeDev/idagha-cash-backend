import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private client: any = null;
  private ready = false;
  private qrCode: string | null = null;
  private enabled = false;

  async onModuleInit() {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      this.logger.log('WhatsApp disabled (set WHATSAPP_ENABLED=true to enable)');
      return;
    }

    try {
      const { Client, LocalAuth } = await import('whatsapp-web.js');
      const qrcode = await import('qrcode-terminal');

      // On Linux (Render), use bundled Chromium via puppeteer; on Windows use Chrome
      let executablePath: string | undefined;
      if (process.platform === 'win32') {
        executablePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      } else {
        // Let puppeteer find its own bundled Chromium
        executablePath = undefined;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: '/tmp/.wwebjs_auth' }),
        puppeteer: {
          ...(executablePath ? { executablePath } : {}),
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        },
      });

      this.client.on('qr', (qr: string) => {
        this.qrCode = qr;
        this.ready = false;
        this.logger.log('WhatsApp QR code ready — scan it in the terminal');
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        this.ready = true;
        this.qrCode = null;
        this.enabled = true;
        this.logger.log('WhatsApp client is ready');
      });

      this.client.on('disconnected', () => {
        this.ready = false;
        this.logger.warn('WhatsApp client disconnected');
      });

      await this.client.initialize();
    } catch (err: any) {
      this.logger.error('WhatsApp init error: ' + err.message);
    }
  }

  isReady() {
    return this.ready;
  }

  getQr() {
    return this.qrCode;
  }

  // phone: international format without +, e.g. "2348012345678"
  async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.ready) throw new Error('WhatsApp client is not ready. Please scan the QR code first.');
    const chatId = phone.replace(/\D/g, '') + '@c.us';
    await this.client.sendMessage(chatId, message);
  }
}
