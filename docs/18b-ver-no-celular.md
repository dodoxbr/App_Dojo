# Ver o Oss no celular (ambiente local, rede Wi-Fi de casa)

1. PC e celular na **mesma rede Wi-Fi**. Veja o IP do PC (`ipconfig`, linha IPv4 da placa Wi-Fi, ex.: `192.168.1.12`).
2. Painel: com o painel rodando no PC (`npm run dev`), abra no navegador do celular `http://IP-DO-PC:3000` (ex.: `http://192.168.1.12:3000`). Entre com uma conta de demonstração (`demo-a1@example.test` / `demo-senha-123`). Câmera e galeria funcionam no envio de foto do feed.
   - O `next.config.ts` já libera redes `192.168.*.*` e `10.0.*.*` no modo de desenvolvimento.
   - Se não abrir: o Windows Defender Firewall precisa permitir o Node.js em rede privada.
   - O link do e-mail de confirmação aponta para `localhost`; no celular use as contas de demonstração.
3. App (Expo Go): em `apps/mobile/.env` troque `EXPO_PUBLIC_SUPABASE_URL` para `http://IP-DO-PC:54321`, rode `npm run start` em `apps/mobile` e leia o QR code com o Expo Go.
4. Só para apresentar fora de casa seria preciso hospedagem ou um túnel; um túnel expõe os dados de teste na internet e não foi configurado.
