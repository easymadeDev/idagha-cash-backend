import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private ready = false;

  constructor() {
    this.logger.log('WhatsApp Service initialized (Baileys disabled to prevent server crashes)');
  }

  isReady(): boolean {
    return this.ready;
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    // Disabled: Baileys causes code 440 timeouts and crashes Render
    this.logger.debug(`WhatsApp message skipped (service disabled): ${phone.slice(-4)}`);
  }

  getQr() {
    return null;
  }
}
