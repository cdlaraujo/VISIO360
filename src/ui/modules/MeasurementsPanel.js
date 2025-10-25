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

        this._measurementClickHandler = null; // Store handler reference for removal

        this._setupEventListeners();
    }

    /**
     * Sets up EventBus listeners relevant to measurement display updates.
     * @private
     */
    _setupEventListeners() {
        // Listen for the event that provides the measurement stats
        this.eventBus.on('ui:measurements:update', stats => this._updateMeasurementsUI(stats));
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
                itemEl.innerHTML = `
                    <span class="measurement-value">${item.value.toFixed(2)}${unit}</span>
                    <button class="delete-btn" data-id="${item.id}" title="Remover">×</button>
                `;
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

        // Add event delegation for delete buttons
        // Remove the old listener before adding a new one to prevent duplicates
        if (this._measurementClickHandler) {
            this.ui.measurementsContainer.removeEventListener('click', this._measurementClickHandler);
        }
        
        if (hasMeasurements) {
            this._measurementClickHandler = (event) => {
                if (event.target.classList.contains('delete-btn')) {
                    const id = event.target.dataset.id;
                    if (id) {
                        // Emit an event requesting the deletion, App.js will handle it
                        this.eventBus.emit('measurement:delete', { id });
                    }
                }
            };
            this.ui.measurementsContainer.addEventListener('click', this._measurementClickHandler);
        } else {
             this._measurementClickHandler = null; // Clear handler if no measurements
        }
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