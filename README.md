# VISIO360 - Visualizador de Modelos 3D

## Descrição

O VISIO360 é um visualizador de modelos 3D interativo construído com tecnologias web modernas. Ele permite carregar, visualizar e interagir com modelos 3D (nos formatos `.glb`, `.gltf`, `.obj`, `.stl`, `.ply`), oferecendo ferramentas para medição de distância, cálculo de área e anotações. A aplicação é encapsulada como um aplicativo de desktop usando Tauri.

## Estrutura do Projeto

O projeto segue uma arquitetura modular para separar as responsabilidades e facilitar a manutenção.

-   **/src**: Contém todo o código-fonte da aplicação.
    -   **/core**: Classes centrais que gerenciam o estado e a comunicação.
        -   `Visio360Viewer.js`: A classe principal que orquestra todos os módulos.
        -   `StateManager.js`: Gerencia o estado global da aplicação (ex: modo da ferramenta atual).
        -   `EventBus.js`: Um sistema de eventos para comunicação desacoplada entre os módulos.
    -   **/modules**: Módulos responsáveis por funcionalidades específicas.
        -   `SceneManager.js`: Gerencia a cena 3D, câmera, luzes e o loop de renderização.
        -   `UIManager.js`: Controla todos os elementos da interface do usuário (botões, overlays).
        -   `InteractionController.js`: Captura e gerencia as interações do usuário (cliques, movimentos do mouse).
        -   `ToolController.js`: Contém a lógica para as ferramentas (medição, anotação, etc.).
    -   `main.js`: O ponto de entrada da aplicação. Inicializa o `Visio360Viewer`.
-   **/src-tauri**: Contém o código e a configuração do backend Tauri.
-   **index.html**: A página principal da aplicação.
-   **package.json**: Define os scripts e dependências do projeto.

## Tecnologias Utilizadas

-   **Vite**: Ferramenta de build para desenvolvimento frontend rápido.
-   **Three.js**: Biblioteca para renderização 3D.
-   **Tauri**: Framework para criar aplicações de desktop leves usando tecnologias web.

## Como Executar o Projeto

### Pré-requisitos

-   Node.js e npm
-   Dependências do Tauri (siga o [guia oficial](https://tauri.app/v1/guides/getting-started/prerequisites/))

### Passos para Instalação

1.  **Clone o repositório:**
    ```bash
    git clone <url-do-seu-repositorio>
    cd visio360
    ```

2.  **Instale as dependências do Node.js:**
    ```bash
    npm install
    ```

3.  **Execute em modo de desenvolvimento:**
    ```bash
    npm run tauri dev
    ```
    Isso abrirá a janela do aplicativo e recarregará automaticamente ao salvar as alterações.

4.  **Compile a versão final:**
    ```bash
    npm run tauri build
    ```
    O executável final estará localizado em `src-tauri/target/release/`.