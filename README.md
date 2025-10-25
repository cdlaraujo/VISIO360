VISIO360 - Análise Técnica do Código-Fonte
Este documento é uma análise técnica da arquitetura de software do VISIO360. Ele é focado em explicar como o código-fonte está estruturado, quais padrões de design foram usados e como os principais sistemas interagem.

1. Conceitos Fundamentais da Arquitetura
Para entender o código, é crucial entender os três padrões de design que controlam toda a aplicação:

EventBus (Sistema Nervoso Central):

Arquivo-chave: src/app/EventBus.js

Conceito: Nenhum módulo "conhece" outro módulo diretamente. A comunicação é 100% desacoplada.

Como funciona:

Um módulo (ex: UIManager.js) emite um evento: eventBus.emit('tool:activate', { tool: 'measure' }).

Outro módulo (ex: ToolController.js) está ouvindo esse evento: eventBus.on('tool:activate', ...) e reage a ele.

Resultado: Os módulos UI não precisam de uma instância do ToolController e vice-versa. Podemos adicionar ou remover módulos sem quebrar a aplicação.

Padrão Coordenador (Gerenciamento de Domínio):

Arquivos-chave: src/app/App.js, src/ui/UIManager.js, src/modules/measurements.js, src/modules/collaboration.js

Conceito: As classes "principais" não fazem o trabalho pesado. Elas atuam como "maestros" ou "gerentes" que instanciam e coordenam um conjunto de "trabalhadores" (módulos especializados).

Exemplo: O UIManager.js não manipula o DOM diretamente. Em vez disso, ele instancia CollaborationUI, ModelUI, MeasurementsPanel e AppChromeUI, passando a eles as referências de DOM que eles precisam.

Padrão de Estado (State Pattern) para Interação:

Arquivos-chave: src/ui/ToolController.js (Factory), src/core/InteractionController.js (Contexto), src/core/interaction-states/ (Estados Concretos).

Conceito: A lógica de interação do usuário (cliques, movimentos do mouse) não é tratada por um switch ou if/else gigantesco. Em vez disso, o comportamento da interação é encapsulado em objetos de "Estado".

Como funciona:

ToolController.js ouve o evento tool:activate.

Ele instancia o objeto de Estado apropriado (ex: new PointMeasurementState()).

Ele injeta esse estado no InteractionController.js usando interactionController.setState(newState).

O InteractionController.js agora delega todos os eventos de mouse (ex: _onClick) para o estado ativo: this.currentState.onClick(...).

O estado IdleState (padrão) reativa os controles de órbita; os outros estados os desativam.

2. Estrutura de Arquivos e Responsabilidades
Aqui está um detalhamento do que cada parte do código-fonte faz.

Arquivos Raiz
index.html: O esqueleto DOM da aplicação. Define todos os divs e buttons com os IDs que os módulos de UI irão procurar (ex: #model-name-display, #measure-tool-btn).

src/main.js: O ponto de entrada da aplicação. Ele espera o DOM carregar, instancia new App() e chama app.start().

/src/app/ (O Núcleo da Aplicação)
App.js: O coordenador-mestre. Instancia todos os sistemas principais (Core, UI, Módulos), injeta o EventBus e o Logger em todos, e configura as integrações de alto nível entre módulos (ex: model:loaded -> collaboration.setModelData).

EventBus.js: Implementação simples do padrão Pub/Sub.

/src/core/ (Sistemas de Renderização e Interação)
Renderer.js: Gerencia a criação da câmera e do WebGLRenderer do Three.js. Ouve app:update para chamar render() a cada frame.

SceneManager.js: Cria a THREE.Scene, adiciona iluminação ambiente, luzes direcionais e o grid.

AnimationLoop.js: Apenas uma responsabilidade: chamar requestAnimationFrame em loop e emitir o evento app:update a cada tick, servindo como o "coração" da aplicação.

ModelLoader.js: Ouve model:load. Usa os loaders corretos do Three.js (PLYLoader, GLTFLoader) para carregar o modelo. Após o sucesso, centraliza o modelo, aplica uma rotação padrão e emite model:loaded com o objeto THREE.Mesh/Group e o Blob original.

InteractionController.js: O Contexto de Interação. Gerencia os OrbitControls, o Raycaster e o mouse. O mais importante: ele não sabe o que fazer quando o usuário clica; ele apenas delega o clique para this.currentState.onClick().

/interaction-states/: Os Estados de Interação.

BaseInteractionState.js: Define a interface (onEnter, onExit, onClick, getCursor) que todos os estados devem implementar.

IdleState.js: Habilita os OrbitControls.

PointMeasurementState.js: Usado por Distância e Ângulo. Em onClick, emite measurement:point:selected.

PolygonMeasurementState.js: Usado por Área, Superfície e Volume. Herda de PointMeasurementState e adiciona onKeyDown (para 'Esc') e onDoubleClick para emitir measurement:area:finish.

/src/ui/ (Lógica da Interface do Usuário)
UIManager.js: Coordenador da UI. Sua função principal é _getUIReferences (pegar todos os elementos DOM) e initialize (instanciar os módulos-filho, passando os elementos DOM que eles precisam).

ToolController.js: A Fábrica de Estados de interação. Ouve tool:activate e injeta o estado correto no InteractionController.

/modules/AppChromeUI.js: Gerencia a UI "global": botões de ferramenta (realce active), barra de status, notificações e barras de progresso.

/modules/ModelUI.js: Gerencia o modal de carregamento de modelo e o painel de propriedades do modelo (nome, vértices).

/modules/CollaborationUI.js: Gerencia o painel de colaboração (criar/entrar na sala, lista de peers).

/modules/MeasurementsPanel.js: Gerencia o painel direito, renderizando a lista de medições concluídas e os botões de exclusão.

/src/modules/ (Lógica de Negócios / Funcionalidades)
measurements.js: Coordenador de Medição. Instancia todas as classes de medição (ex: DistanceMeasurement) e o MeasurementUI (para instruções). Ouve todos os eventos measurement:*:completed para atualizar o painel da UI. Também ouve tool:changed para cancelar medições ativas.

/measurements/: Contém as classes de lógica para cada ferramenta.

DistanceMeasurement.js: Ouve measurement:point:selected. Ao ter 2 pontos, calcula a distância, desenha a linha/label e emite measurement:distance:completed.

SurfaceAreaMeasurement.js: Ouve measurement:area:finish. Inicia um Web Worker (surfaceArea.worker.js) para o cálculo pesado, passando os dados da geometria. Ouve onmessage do worker. Quando o worker retorna o resultado, ele desenha o destaque e emite measurement:surfaceArea:completed.

VolumeMeasurement.js: Lógica idêntica ao SurfaceArea, mas chama volume.worker.js.

/measurements/common/: Classes base para evitar repetição de código.

BaseMeasurement.js: Lógica comum para _handlePointSelected, _startMeasurement, cancelActiveMeasurement.

BasePolygonMeasurement.js: Herda de BaseMeasurement e adiciona lógica para ferramentas de polígono (linha de preview, _finishMeasurement ao ouvir measurement:area:finish).

/measurements/utils/:

SurfaceAreaCalculator.js / VolumeCalculator.js: As classes que contêm a lógica matemática pura. Elas são copiadas para dentro dos arquivos de worker para serem executadas fora da thread principal.

MeasurementDisposer.js: Lógica para limpar a memória da GPU, removendo geometrias, materiais e texturas (especialmente de labels).

collaboration.js: Coordenador de Colaboração. Instancia todos os módulos P2P (ConnectionManager, RoomManager, FileTransferSender, FileTransferReceiver, AnnotationSync, ModelSyncManager, PeerProfileManager) e os interliga.

/collaboration/: Módulos de trabalho P2P.

ConnectionManager.js: Wrapper em torno da API do PeerJS. Gerencia a conexão física (peer.connect, peer.on('connection'), conn.on('data')).

RoomManager.js: Gerencia a lógica de "sala" (criar, entrar, sair, gerenciar ID da sala na URL).

AnnotationSync.js: Ouve eventos de medição locais (ex: measurement:distance:completed), formata-os em JSON e os transmite (connectionManager.broadcast). Também ouve connection:data para receber anotações remotas e desenhá-las na cena.

ModelSyncManager.js: Armazena o Blob do modelo carregado. Ouve connection:opened (novo peer) e, se for o host, envia automaticamente o modelo para o novo peer usando o FileTransferSender.

FileTransferSender.js / FileTransferReceiver.js: Lidam com a fragmentação (chunking) e reconstrução de arquivos grandes (Blobs) para transferência via WebRTC.

3. Fluxos de Dados Essenciais (Como o Código "Executa")
Seguir o fluxo de um evento é a melhor maneira de entender o código.

Fluxo 1: Ativação da Ferramenta de Distância
Usuário clica no botão "Distância" no index.html.

UIManager.js (_setupEventListeners) captura o clique e emite: eventBus.emit('tool:activate', { tool: 'measure' }).

ToolController.js ouve tool:activate, cria new PointMeasurementState() e chama this.interactionController.setState(...).

O PointMeasurementState chama onEnter(), que desabilita os OrbitControls.

ToolController.js também emite eventBus.emit('tool:changed', { activeTool: 'measure' }).

AppChromeUI.js ouve tool:changed e atualiza a UI para destacar o botão "Distância" (adicionando a classe .active).

MeasurementUI.js (em measurements.js) ouve tool:changed e atualiza o texto de instruções na barra de status.

Fluxo 2: Realização de uma Medição de Distância (continuação)
Usuário clica na cena.

InteractionController.js (_onClick) captura o clique, faz o raycast, e chama this.currentState.onClick(point).

PointMeasurementState.js (onClick) emite: eventBus.emit('measurement:point:selected', { point, tool: 'measure' }).

DistanceMeasurement.js (_setupEventListeners) ouve measurement:point:selected.

DistanceMeasurement.js (_handlePointSelected) armazena o ponto. Como é o segundo ponto, ele chama _completeMeasurement().

_completeMeasurement() calcula a distância, desenha a linha/label, e emite: eventBus.emit('measurement:distance:completed', { measurement }).

measurements.js (Coordenador) ouve measurement:distance:completed e chama this.measurementUI.update().

MeasurementUI.js (update) chama this.manager.getMeasurementStats() (que coleta dados de todas as medições) e emite eventBus.emit('ui:measurements:update', stats).

MeasurementsPanel.js ouve ui:measurements:update e chama _updateMeasurementsUI(stats), que renderiza o HTML no painel direito.

AnnotationSync.js (Módulo de Colaboração) também ouve measurement:distance:completed, formata a medição como JSON e chama this.connectionManager.broadcast(...) para enviá-la a outros peers.

Fluxo 3: Cálculo de Área de Superfície (Web Worker)
Usuário desenha um polígono e dá duplo-clique.

InteractionController.js (_onDoubleClick) -> this.currentState.onDoubleClick().

PolygonMeasurementState.js (onDoubleClick) emite: eventBus.emit('measurement:area:finish').

SurfaceAreaMeasurement.js ouve measurement:area:finish e chama _finishMeasurement().

_finishMeasurement():

Encontra o modelo 3D ativo na cena (_findActiveModel).

Extrai os dados de geometria (vértices, índices).

Inicia this.worker = new Worker(...).

Envia os dados da geometria para o worker: this.worker.postMessage({ meshesData, polygonData }, [transferable_buffers]).

surfaceArea.worker.js (onmessage) recebe os dados.

O worker instancia new SurfaceAreaCalculator() e executa o cálculo pesado (pode levar vários segundos).

O worker envia o resultado de volta: self.postMessage({ status: 'success', surfaceArea, ... }).

SurfaceAreaMeasurement.js (this.worker.onmessage) recebe o resultado, desenha a geometria de destaque e emite eventBus.emit('measurement:surfaceArea:completed').

O fluxo para atualizar a UI (Painel de Medições) e sincronizar (AnnotationSync) segue como no Fluxo 2.

4. Guia de Início Rápido (Execução)
Pré-requisitos
Node.js e npm:

Dependências do Tauri: Siga o (requer Rust e ferramentas de build C++).

Instalação e Execução
Clone o repositório:

Instale as dependências:

Execute em modo de desenvolvimento: