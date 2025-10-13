============================================================
  VISIO360 - GUIA DE INSTALAÇÃO E USO PARA O CLIENTE
============================================================

Obrigado por adquirir o Visualizador 3D Colaborativo!
Este guia irá ajudá-lo a colocar a aplicação no ar em minutos.

------------------------------------------------------------
🚀 OPÇÃO 1: INSTALAÇÃO RÁPIDA (RECOMENDADO - 2 MINUTOS)
------------------------------------------------------------
A forma mais fácil de hospedar a aplicação é usando um serviço gratuito como o Netlify.

1.  Vá para: https://app.netlify.com/drop
2.  Arraste a pasta inteira deste projeto (a que contém o arquivo `index.html`) para a janela do seu navegador.
3.  Aguarde 30 segundos enquanto o Netlify faz o upload e publica seu site.
4.  Pronto! Você receberá um link público (ex: `https://meu-projeto-123.netlify.app`). Guarde este link.

------------------------------------------------------------
📖 COMO USAR A APLICAÇÃO
------------------------------------------------------------
1.  **ABRA O LINK:**
    Abra o link que você obteve na etapa anterior (ou o link do seu próprio servidor) em seu navegador (Google Chrome recomendado).

2.  **CARREGUE UM MODELO 3D:**
    Para que a colaboração funcione, o modelo 3D precisa estar acessível através de um link público (URL).
    - Cole a URL do seu arquivo `.glb`, `.gltf` ou `.ply` no campo "Cole a URL do modelo 3D aqui".
    - Clique em "Carregar Modelo via URL".
    (O carregamento de um arquivo do seu computador só funciona para visualização individual).

3.  **CRIE UMA SALA DE COLABORAÇÃO:**
    - Digite seu nome.
    - Clique no botão "🚀 Criar Nova Sala".

4.  **CONVIDE SUA EQUIPE:**
    - Após criar a sala, clique no botão "📋 Copiar Link de Convite".
    - Envie este link para as pessoas com quem você deseja colaborar.

5.  **COLABORE EM TEMPO REAL:**
    - Quando seus colegas abrirem o link, eles entrarão na mesma sala e verão o mesmo modelo 3D.
    - Use as ferramentas de medição (Distância, Área, etc.). Todas as medições que você criar aparecerão instantaneamente na tela de todos!

------------------------------------------------------------
❓ PERGUNTAS FREQUENTES (FAQ)
------------------------------------------------------------
P: Onde devo hospedar meu modelo 3D para obter uma URL?
R: Você pode usar o armazenamento de objetos do seu provedor de nuvem (Amazon S3, Google Cloud Storage, Azure Blob Storage) ou qualquer servidor web que sua empresa já utilize. Certifique-se de que o arquivo tenha permissões de leitura pública.

P: Preciso de um servidor especial ou banco de dados?
R: **Não.** A beleza desta aplicação é que ela é "serverless". Ela roda inteiramente nos navegadores dos usuários. Você só precisa de um lugar para hospedar os arquivos estáticos (HTML, JS), como o Netlify.

P: Quantas pessoas podem entrar em uma sala?
R: A tecnologia WebRTC funciona melhor com grupos de até 8-10 usuários por sala. Para mais usuários, o desempenho pode variar dependendo da conexão de internet de cada um.

P: As medições ficam salvas?
R: As medições são sincronizadas em tempo real e existem enquanto houver pelo menos uma pessoa na sala. Se todos saírem, a sessão é encerrada e as medições são perdidas.

------------------------------------------------------------
🔧 RESOLUÇÃO DE PROBLEMAS
------------------------------------------------------------
-   **"A colaboração não funciona / Ninguém consegue se conectar."**
    Certifique-se de que todos estão usando o link com `https://`. Conexões seguras são obrigatórias para a tecnologia WebRTC funcionar.

-   **"O modelo 3D não carrega a partir da URL."**
    Verifique se a URL está correta e se o arquivo está publicamente acessível (tente abrir a URL diretamente no seu navegador). Verifique também as permissões de CORS do seu servidor de arquivos.

-   **"A página está em branco ou mostra um erro."**
    Pressione a tecla `F12` no seu navegador para abrir o "Console do Desenvolvedor". Procure por mensagens de erro em vermelho e, se precisar de suporte, envie-nos um print dessa tela.

============================================================
Suporte: seu-email-de-suporte@suaempresa.com