import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor() {
    this.logger.log('WhatsApp Service: Email-only mode (Baileys disabled)');
  }

  isReady(): boolean {
    return false;
  }

  getQr() {
    return null;
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    // Disabled
  }

  async sendImageMessage(phone: string, imagePath: string, caption: string): Promise<void> {
    // Disabled
  }
}
