import { EventEmitter } from "events";
import logger from "../config/logger.config";

// ─── Typed event map — prevents typos in event names ─────────────

export interface PayWalletEvents {
  transaction_completed: {
    transactionId: string;
    senderId: string;
    receiverId: string;
    amount: number;
    currency: string;
  };
  transaction_failed: {
    transactionId: string;
    userId: string;
    reason: string;
  };
  user_registered: {
    userId: string;
    email: string;
    fullName: string;
  };
  kyc_submitted: {
    userId: string;
    email: string;
  };
  login_newDevice: {
    userId: string;
    email: string;
    deviceName: string;
    ipAddress: string;
  };
}

class TypedEventBus extends EventEmitter {
  emit<K extends keyof PayWalletEvents>(
    event: K,
    payload: PayWalletEvents[K],
  ): boolean {
    logger.debug(`Event emitted: ${String(event)}`, payload);
    return super.emit(event as string, payload);
  }

  on<K extends keyof PayWalletEvents>(
    event: K,
    listener: (payload: PayWalletEvents[K]) => void,
  ): this {
    return super.on(event as string, listener);
  }
}

// ─── Singleton — one event bus shared across the entire app ──────
const eventBus = new TypedEventBus();
eventBus.setMaxListeners(20); // Default is 10 — increase for our use case

export default eventBus;
