import { doc, getDoc } from "firebase/firestore";
import { Firestore } from "firebase/firestore";

/**
 * Utility to send notifications to a Telegram Channel via Bot API
 */
export async function sendTelegramNotification(firestore: Firestore, message: string) {
  try {
    const configRef = doc(firestore, "settings", "telegram");
    const configSnap = await getDoc(configRef);
    
    if (!configSnap.exists()) return;
    
    const { botToken, chatId, enabled } = configSnap.data();
    
    if (!enabled || !botToken || !chatId) return;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (error) {
    console.error("Telegram Notification Failed:", error);
  }
}
