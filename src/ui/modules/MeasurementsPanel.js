// src/ui/modules/MeasurementsPanel.js

/**
 * Manages the UI elements related to displaying the list of measurements
 * in the right-hand panel.
 */
export class MeasurementsPanel {
    constructor(logger, eventBus, uiElements) {
        this.logger = logger;
        this.eventBus = eventBus;
        this.ui = uiElements; // Receives elements: measurementsPanel, measurementsContainer

        // --- MODIFICADO: Armazena a referência da função ---
        this._measurementClickHandler = this._handleClick.bind(this);

        this._setupEventListeners();
    }

    /**
     * Sets up EventBus listeners relevant to measurement display updates.
     * @private
     */
    _setupEventListeners() {
        // Listen for the event that provides the measurement stats
        this.eventBus.on('ui:measurements:update', stats => this._updateMeasurementsUI(stats));

        // --- MODIFICADO: Adiciona o ouvinte de clique UMA VEZ ---
        if (this.ui.measurementsContainer) {
            this.ui.measurementsContainer.addEventListener('click', this._measurementClickHandler);
        }
    }

    /**
     * --- NOVO MÉTODO: Lida com todos os cliques no painel ---
     * Usa delegação de eventos.
     * @private
     */
    _handleClick(event) {
        const deleteBtn = event.target.closest('.delete-btn');
        if (deleteBtn) {
            // Caso 1: Clicou no botão de deletar
            event.stopPropagation(); // Impede que o clique no item seja acionado
            const id = deleteBtn.dataset.id;
            if (id) {
                // Emite um evento solicitando a exclusão
                this.eventBus.emit('measurement:delete', { id });
            }
            return;
        }

        const itemEl = event.target.closest('.measurement-item');
        if (itemEl) {
            // Caso 2: Clicou em qualquer outro lugar do item
            const id = itemEl.dataset.id;
            if (id) {
                // Emite um evento solicitando o destaque
                this.eventBus.emit('measurement:highlight', { id });
            }
        }
    }

    /**
     * Updates the measurement list UI based on the provided stats.
     * (Moved directly from UIManager.js)
     * @param {Object} stats - Object containing arrays of distances, areas, etc.
     * @private
     */
    _updateMeasurementsUI(stats) {
        if (!this.ui.measurementsContainer) return;

        this.ui.measurementsContainer.innerHTML = '';
        let hasMeasurements = false;

        // Helper function to create a group of measurements (Distance, Area, etc.)
        const createGroup = (title, items, unit) => {
            if (!items || items.length === 0) return;

            hasMeasurements = true;
            const groupDiv = document.createElement('div');
            groupDiv.className = 'measurement-group';

            const titleEl = document.createElement('div');
            titleEl.className = 'measurement-group-title';
            titleEl.textContent = title;
            groupDiv.appendChild(titleEl);

            items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'measurement-item';
                // --- MODIFICADO: Adiciona data-id ao item e o span do autor ---
                itemEl.dataset.id = item.id;
                itemEl.innerHTML = `
                    <div class="measurement-item-info">
                        <span class="measurement-value">${item.value.toFixed(2)}${unit}</span>
                        <span class="measurement-author">${item.peerName || ''}</span>
                    </div>
                    <button class="delete-btn" data-id="${item.id}" title="Remover">×</button>
                `;
                // --- FIM DA MODIFICAÇÃO ---
                groupDiv.appendChild(itemEl);
            });

            this.ui.measurementsContainer.appendChild(groupDiv);
        };

        // Create groups for each measurement type
        createGroup('Distâncias', stats.distances, 'm');
        createGroup('Áreas Planas', stats.areas, 'm²');
        createGroup('Áreas de Superfície', stats.surfaceAreas, 'm²');
        createGroup('Ângulos', stats.angles, '°');
        createGroup('Volumes', stats.volumes, 'm³'); // <-- ADICIONADO

        // Show/hide the panel container based on whether there are measurements
        this._safeUpdateElement(this.ui.measurementsPanel, el => {
            // Check if measurementsContainer itself has any child elements
            el.style.display = this.ui.measurementsContainer.hasChildNodes() ? 'block' : 'none';
        });

        // --- MODIFICADO: A lógica de adicionar/remover listener foi movida ---
        // Não é mais necessário fazer nada aqui.
    }

    // --- Helper functions also moved ---
    _safeUpdateElement(element, updateFn) {
        if (element) {
            try {
                updateFn(element);
            } catch (error) {
                this.logger.error('MeasurementsPanel: Error updating UI element', error);
            }
        }
    }
}