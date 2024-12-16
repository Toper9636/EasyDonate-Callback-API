import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import crypto from 'crypto';
import * as https from 'https';
require('dotenv').config();

const API_KEY = process.env.EASYDONATE_API_KEY || ``;

export namespace EasyDonate {
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
        payment_id: string;
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
        const { payment_id, cost, customer, signature } = req.body;
        
        // Генерация сигнатуры
        const generatedSignature = EasyDonate.CallbackAPI.generateSignature(payment_id, cost, customer);

        // Проверка сигнатуры
        if (generatedSignature !== signature) {
            console.log(`Bad signature: ${generatedSignature} !== ${signature}`);
            res.status(400).send('Bad signature.');
            return;
        }

        // Ваша логика обработки платежа здесь
        res.send('OK');
        console.log(`Payment ${payment_id} processed (+${cost} RUB from ${customer})`);
    });
}