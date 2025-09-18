/**
 * @class UIManager
 * @description Gerencia todos os elementos da interface do usuário e emite eventos com base nas interações do usuário.
 */
export class UIManager {
    constructor(logger, eventBus) {
        this.logger = logger;
        this.eventBus = eventBus;

        // Referências aos elementos da UI
        this.fileInput = document.getElementById('model-input');
        this.measureToolBtn = document.getElementById('measure-tool-btn');
    }

    /**
     * Inicializa os listeners de eventos da UI.
     * Este método é chamado uma vez quando a aplicação inicia.
     */
    initialize() {
        if (this.fileInput) {
            this.fileInput.addEventListener('change', this._handleFileSelect.bind(this));
        } else {
            this.logger.error('UIManager: Elemento de input de arquivo #model-input não encontrado.');
        }

        if (this.measureToolBtn) {
            this.measureToolBtn.addEventListener('click', () => {
                // Quando o botão é clicado, emite um evento para o ToolController.
                this.eventBus.emit('tool:activate', { tool: 'measure' });
            });
        } else {
            this.logger.error('UIManager: Botão da ferramenta de medição #measure-tool-btn não encontrado.');
        }

        // Ouve o evento 'tool:changed' emitido pelo ToolController para atualizar a UI.
        this.eventBus.on('tool:changed', (payload) => this._updateToolButtons(payload.activeTool));

        this.logger.info('UIManager: Inicializado e ouvindo eventos da UI.');
    }

    /**
     * Lida com a seleção de um arquivo pelo usuário.
     * @param {Event} event - O evento de 'change' do input de arquivo.
     * @private
     */
    _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) {
            this.logger.warn('UIManager: Nenhum arquivo selecionado.');
            return;
        }

        // Para carregar um arquivo local, criamos uma "URL de objeto" temporária.
        // Esta URL pode ser usada pelo loader como se fosse uma URL de servidor.
        const fileURL = URL.createObjectURL(file);
        this.logger.info(`UIManager: Arquivo selecionado - ${file.name}. URL de objeto criada.`);

        // Emite o evento para que o ModelLoader possa carregar o arquivo.
        this.eventBus.emit('model:load', { url: fileURL, fileName: file.name });

        // Limpa o valor do input para permitir carregar o mesmo arquivo novamente no futuro.
        event.target.value = null;
    }

    /**
     * Atualiza o estado visual dos botões de ferramenta com base na ferramenta ativa.
     * @param {string} activeTool - O nome da ferramenta ativa ('none', 'measure', etc.).
     * @private
     */
    _updateToolButtons(activeTool) {
        if (this.measureToolBtn) {
            // Adiciona ou remove a classe 'active' para mudar o estilo CSS do botão.
            if (activeTool === 'measure') {
                this.measureToolBtn.classList.add('active');
            } else {
                this.measureToolBtn.classList.remove('active');
            }
        }
        // Se tivéssemos outros botões, a lógica para eles viria aqui.
    }
}
