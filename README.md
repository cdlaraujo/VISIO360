VISIO360 - Visualizador de Modelos 3D de Alta Performance 🚀

📖 Sumário
Visão Geral

✨ Funcionalidades Principais

🏛️ Mergulho Profundo na Arquitetura

O Coração da Aplicação

Os Módulos Especialistas

O Fluxo de um Evento: Um Exemplo Prático

🛠️ Pilha de Tecnologias

🚀 Guia de Início Rápido

Pré-requisitos

Instalação e Execução

📜 Scripts Disponíveis

🗺️ Roadmap de Futuro

🤝 Como Contribuir

📄 Licença

🌟 Visão Geral do Projeto
O VISIO360 nasceu da necessidade de uma ferramenta ágil e eficiente para a visualização de modelos 3D complexos diretamente no desktop. Diferente de soluções pesadas e caras, o VISIO360 utiliza o poder das tecnologias web modernas, como Three.js, para renderização 3D de alta qualidade, e o Tauri, para empacotar tudo em uma aplicação nativa, segura e com baixíssimo consumo de recursos.

A filosofia do projeto é baseada em modularidade e desacoplamento. Cada parte da aplicação é um especialista em sua própria área, e a comunicação entre eles é orquestrada por um EventBus central. Isso não apenas torna o código mais limpo e fácil de manter, mas também abre portas para que novas ferramentas e funcionalidades sejam adicionadas com o mínimo de atrito.

✨ Funcionalidades Principais
Carregamento de Múltiplos Formatos: Suporte nativo para os formatos mais populares da indústria: .ply, .gltf e .glb. A arquitetura de ModelLoader permite a fácil adição de novos loaders (como para .obj ou .stl).

Navegação 3D Intuitiva: Controles de órbita (OrbitControls) para uma inspeção detalhada do modelo, permitindo zoom, rotação e pan com fluidez.

Foco Automático Inteligente: Ao carregar um novo modelo, a câmera se ajusta e foca automaticamente no objeto, centralizando-o na cena para uma visualização imediata e otimizada.

Interface de Usuário Reativa: Uma UI limpa e minimalista que permite o carregamento de arquivos e a ativação de ferramentas. Os botões de ferramentas atualizam seu estado visual para refletir a ferramenta ativa no momento.

Ferramenta de Medição de Distância: Uma ferramenta interativa para medir a distância entre dois pontos selecionados no modelo 3D.

Estrutura Cross-Platform: Graças ao Tauri, o mesmo código base gera executáveis nativos para Windows, macOS e Linux.

🏛️ Mergulho Profundo na Arquitetura
A espinha dorsal do VISIO360 é uma arquitetura orientada a eventos. Nenhum módulo "conhece" diretamente os outros. Em vez disso, eles se comunicam emitindo e ouvindo eventos. Isso cria um sistema resiliente e extensível.

O Coração da Aplicação (/src/core)
App.js: É o maestro da orquestra. Sua responsabilidade é instanciar todos os sistemas centrais e módulos, injetando as dependências necessárias (como o Logger e o EventBus) e iniciando o loop principal da aplicação (_animate).

EventBus.js: O sistema nervoso central. É uma classe simples, porém poderosa, que implementa o padrão Publish/Subscribe. Módulos podem se inscrever (on) para ouvir um evento, emitir (emit) um evento para o resto da aplicação, ou se desinscrever (off).

StateManager.js: Um gerenciador de estado centralizado. Embora ainda não totalmente integrado, ele serve para armazenar o estado global da aplicação de forma previsível (por exemplo, a ferramenta ativa, o modelo carregado, etc.).

Os Módulos Especialistas (/src/modules)
Cada módulo tem uma única responsabilidade, ouvindo eventos do EventBus para saber quando agir e emitindo eventos para comunicar suas atualizações.

Renderer.js: O mestre da renderização. Ele inicializa a cena THREE.Scene, a câmera THREE.PerspectiveCamera e o renderizador WebGLRenderer. Ele ouve o evento model:loaded para saber quando adicionar um novo objeto à cena e o evento app:update para renderizar a cena a cada frame.

UIManager.js: O gerente da interface com o usuário. Ele controla os elementos HTML (botões, inputs). Ele não sabe como carregar um modelo, apenas que, quando o usuário seleciona um arquivo, ele deve emitir o evento model:load com a URL do arquivo. Da mesma forma, quando um botão de ferramenta é clicado, ele emite tool:activate.

ModelLoader.js: O especialista em carregamento. Ele ouve o evento model:load emitido pelo UIManager. Com base na extensão do arquivo, ele seleciona o loader apropriado do Three.js e carrega o modelo. Após o sucesso (ou falha), ele emite os eventos model:loaded ou model:load:error.

InteractionController.js: O controlador de interação com a cena 3D. Ele inicializa os OrbitControls e ouve o evento app:update para atualizar os controles a cada frame. Crucialmente, ele também pode ouvir eventos para alterar o comportamento da câmera ou para lidar com interações de mouse/picking diretamente na cena 3D, como selecionar pontos para a ferramenta de medição.

ToolController.js: O cérebro das ferramentas. Ele ouve o evento tool:activate vindo da UIManager. Sua função é gerenciar qual ferramenta está ativa. Ao trocar de ferramenta, ele emite o evento tool:changed, que pode ser ouvido por outros módulos (como o UIManager para atualizar a UI, ou o InteractionController para mudar o comportamento do clique do mouse).

O Fluxo de um Evento: Um Exemplo Prático
Vamos seguir o fluxo de ativação da ferramenta de medição:

Usuário: Clica no botão "Medir Distância" na interface.

UIManager.js: O EventListener do botão é acionado. O UIManager não sabe o que "medir" significa, ele apenas emite um evento: eventBus.emit('tool:activate', { tool: 'measure' }).

ToolController.js: Este módulo está ouvindo (on) o evento tool:activate. Ele recebe o payload, atualiza seu estado interno para this.activeTool = 'measure', e notifica o resto da aplicação sobre a mudança, emitindo: eventBus.emit('tool:changed', { activeTool: 'measure' }).

De volta ao UIManager.js: Ele também ouve o evento tool:changed. Ao recebê-lo, ele executa a função _updateToolButtons, que verifica qual ferramenta está ativa e adiciona a classe CSS .active ao botão correspondente, fornecendo feedback visual ao usuário.

InteractionController.js (Potencialmente): Poderia ouvir o tool:changed e, se a ferramenta ativa for 'measure', ele poderia desativar os OrbitControls e começar a registrar os cliques do mouse para capturar pontos de medição.

🛠️ Pilha de Tecnologias
Core Framework: Tauri - Permite criar aplicações desktop usando tecnologias web como backend e frontend. O resultado é um binário pequeno, rápido e seguro.

Renderização 3D: Three.js - A biblioteca mais popular e robusta para criar e exibir gráficos 3D no navegador com WebGL.

Build Tool: Vite - Uma ferramenta de build extremamente rápida que oferece Hot Module Replacement (HMR) instantâneo e um processo de build otimizado para produção.

Linguagem: JavaScript (ES6 Modules) - Código moderno e modular.

🚀 Guia de Início Rápido
Para colocar o VISIO360 para rodar na sua máquina local, siga os passos abaixo.

Pré-requisitos
Antes de começar, garanta que você tem o seguinte instalado:

Node.js e npm: Instale aqui

Dependências do Tauri: Siga o guia oficial para o seu sistema operacional: Guia de Pré-requisitos do Tauri (isso geralmente envolve instalar Rust e algumas bibliotecas de build).

Instalação e Execução
Clone este repositório:

Bash

git clone https://github.com/cdlaraujo/visio360.git
cd visio360
Instale as dependências do projeto:

Bash

npm install
Execute em modo de desenvolvimento:

Bash

npm run tauri dev
A aplicação irá compilar e abrir em uma janela nativa. O Vite fornecerá hot-reloading, então qualquer alteração no código-fonte (/src) será refletida instantaneamente na aplicação.

📜 Scripts Disponíveis
Dentro do package.json, você encontrará os seguintes scripts:

npm run dev: Inicia o servidor de desenvolvimento do Vite.

npm run build: Gera a build de produção otimizada do frontend com o Vite.

npm run preview: Previsualiza a build de produção localmente.

npm run tauri: Comando principal do Tauri CLI. Use-o para dev, build, etc.

🗺️ Roadmap de Futuro
O VISIO360 está em constante evolução. Aqui estão algumas das funcionalidades planejadas para o futuro:

[ ] Mais Ferramentas: Adicionar ferramentas de cálculo de área, anotações e corte transversal.

[ ] Suporte a Mais Formatos: Integrar loaders para .obj, .stl e .fbx.

[ ] Árvore de Cena: Implementar uma UI que mostre a hierarquia do modelo carregado, permitindo selecionar/isolar partes específicas.

[ ] Manipulação de Materiais: Permitir a troca de cores, texturas e materiais do modelo em tempo real.

[ ] Configurações de Cena: Adicionar controles na UI para mudar a iluminação, o fundo e outros aspectos da cena.

[ ] Salvar/Carregar Estado da Sessão: Salvar o estado da cena, incluindo a posição da câmera e as medições, para serem carregados posteriormente.

🤝 Como Contribuir
Sua contribuição é muito bem-vinda! Se você tem uma ideia para uma nova funcionalidade, encontrou um bug ou quer melhorar a documentação, por favor, siga estes passos:

Abra uma Issue: Antes de começar a trabalhar, abra uma issue para discutir a mudança que você deseja fazer.

Faça o Fork: Crie um fork do repositório para a sua conta do GitHub.

Crie uma Branch: Crie uma branch descritiva para a sua funcionalidade (git checkout -b feature/minha-feature-incrivel).

Desenvolva: Faça suas alterações e realize commits claros e atômicos.

Envie um Pull Request: Faça o push da sua branch e abra um Pull Request para a branch main do repositório original.

📄 Licença
Este projeto está licenciado sob a Licença MIT. Veja o arquivo LICENSE para mais detalhes.