/**
 * telegram.js — Notifications Telegram pour La Passerelle
 * Envoie des alertes quand l'Amiral doit intervenir
 */

const TG_TOKEN  = process.env.TELEGRAM_BOT_TOKEN
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const https = require('https')

/**
 * Envoie un message Telegram via l'API Bot
 * @param {string} text - Texte du message (supporte le Markdown)
 */
async function sendTelegramMessage(text) {
  if (!TG_TOKEN || !TG_CHAT_ID) return // Pas configuré → silencieux

  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id:    TG_CHAT_ID,
      text,
      parse_mode: 'Markdown',
    })

    const options = {
      hostname: 'api.telegram.org',
      port:     443,
      path:     `/bot${TG_TOKEN}/sendMessage`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (!parsed.ok) {
            console.error('❌ Telegram API error:', parsed.description)
          }
        } catch (_) {}
        resolve()
      })
    })

    req.on('error', (err) => {
      console.error('❌ Telegram request error:', err.message)
      resolve() // Ne pas bloquer
    })

    req.write(body)
    req.end()
  })
}

/**
 * Notifie l'Amiral qu'une intervention est requise
 * @param {Object} mission - La mission concernée
 */
async function notifyIntervention(mission) {
  const text = `🚨 *Intervention requise*\n\nMission: *${mission.titre}*\n\nL'agent attend votre décision.`
  await sendTelegramMessage(text)
}

module.exports = { sendTelegramMessage, notifyIntervention }
