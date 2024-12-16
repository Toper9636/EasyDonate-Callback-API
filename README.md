# EasyDonate Callback API

Простейшая реализация обработчика для Callback API от EasyDonate

## Запуск

### Настройка `.env` файла

```txt
EASYDONATE_API_KEY=abcde123abcde123abcde123abcde123 # Ваш ключ от магазина в EasyDonate

EASYDONATE_HOST_IP=127.0.0.1 # IP-адрес, на котором будет запущен сервер
EASYDONATE_HOST_PORT=8081 # Порт, на котором будет запущен сервер
EASYDONATE_HOST_USE_HTTPS=false # Использовать ли HTTPS

EASYDONATE_HOST_KEY= # Путь к файлу с ключом для HTTPS (Необязательно)
EASYDONATE_HOST_CERT= # Путь к файлу с сертификатом для HTTPS (Необязательно)
EASYDONATE_HOST_PASSPHRASE= # Пароль для ключа HTTPS (Необязательно)
```

### Пример обработчика

```typescript
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import crypto from 'crypto';
import * as https from 'https';
require('dotenv').config();

const API_KEY = process.env.EASYDONATE_API_KEY || ``;

namespace EasyDonate {
    export interface SentCommand {
        command: string;
        response: string;
    }
    export interface Product {
        id: number;
        name: string;
        description: string;
        cost: number;
        image: string;
        commands: Array<string>;
        custom_fields: any; // В этом проекте это не важно
        sales: any; // В этом проекте это не важно
    }
    export interface Payment {
        payment_id: number;
        cost: number;
        customer: string;
        email: string;
        income: number;
        payment_type: string;
        created_at: string;
        updated_at: string;
        sent_commands: SentCommand[];
        products: Product[];
        signature: string;
    }
    export namespace CallbackAPI {
        export function generateSignature(paymentId: number, cost: number, customer: string): string {
            return crypto.createHmac('sha256', API_KEY)
                .update(`${paymentId.toFixed(0)}@${cost.toFixed(0)}@${customer}`) // Формирование строки для хеширования (%s@%s@%s)
                .digest('hex');
        }
    }
}

export async function main() {
    const httpData = {
        ip: process.env.EASYDONATE_HOST_IP || `127.0.0.1`,
        port: Number(process.env.EASYDONATE_HOST_PORT) || 80,
        useHttps: (process.env.EASYDONATE_HOST_USE_HTTPS || ``) === "true" ? process.env.EASYDONATE_HOST_USE_HTTPS : false,
        https: {
            key: process.env.EASYDONATE_HOST_KEY || ``,
            cert: process.env.EASYDONATE_HOST_CERT || ``,
            passphrase: process.env.EASYDONATE_HOST_PASSPHRASE || ``,
        }
    }
    const app = express();
    if (httpData.useHttps) {
        // Создание HTTPS-сервера
        https.createServer({
            key: fs.existsSync(httpData.https.key) ? fs.readFileSync(path.resolve(httpData.https.key)) : httpData.https.key,
            cert: fs.existsSync(httpData.https.cert) ? fs.readFileSync(path.resolve(httpData.https.cert)) : httpData.https.cert,
            passphrase: httpData.https.passphrase,
        }, app).listen(httpData.port, () => {
            console.log(`Server running on https://${httpData.ip}:${httpData.port}`);
        });
    } else {
        // Создание HTTP-сервера
        app.listen(httpData.port, () => {
            console.log(`Server running on http://${httpData.ip}:${httpData.port}`);
        });
    }
    
    // Подключение парсера JSON для обработки POST-запросов
    app.use(bodyParser.json());

    // Обработка POST-запроса от EasyDonate
    app.post('/easydonate/handler', async (req, res) => {
        const paymentData: EasyDonate.Payment = req.body;
        
        // Генерация сигнатуры
        const generatedSignature = EasyDonate.CallbackAPI.generateSignature(paymentData.payment_id, paymentData.cost, paymentData.customer);

        // Проверка сигнатуры
        if (generatedSignature !== paymentData.signature) {
            console.log(`Bad signature: ${generatedSignature} !== ${paymentData.signature}`);
            res.status(400).send('Bad signature.');
            return;
        }

        // Ваша логика обработки платежа здесь
        res.send('OK');
        console.log(`Платеж #${paymentData.payment_id} прошел успешно (+${paymentData.cost} RUB от ${paymentData.customer})`);
    });
}
```