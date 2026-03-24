// src/ui/ToolController.js

import { IdleState }              from '../core/interaction-states/IdleState.js';
import { PointMeasurementState }  from '../core/interaction-states/PointMeasurementState.js';
import { PolygonMeasurementState } from '../core/interaction-states/PolygonMeasurementState.js';
import { getByToolName }          from '../modules/measurements/MeasurementRegistry.js';

/**
 * @class ToolController
 * @description Manages the active tool and delegates interaction state to the
 * InteractionController. Uses the MeasurementRegistry to resolve which
 * interaction state class each tool requires — no hard-coded switch needed.
 */
export class ToolController {
    constructor(logger, eventBus, interactionController) {
        this.logger                = logger;
        this.eventBus              = eventBus;
        this.interactionController = interactionController;

        this.activeToolName = 'none';
        this.activeState    = new IdleState(this.eventBus);
        this.interactionController.setState(this.activeState);

        this._setupEventListeners();
    }

    _setupEventListeners() {
        this.eventBus.on('tool:activate', (payload) => this.setActiveTool(payload.tool));
    }

    setActiveTool(toolName) {
        // Clicking the same tool again deactivates it
        if (this.activeToolName === toolName) {
            toolName = 'none';
        }

        if (this.activeState) {
            this.activeState.onExit(this.interactionController);
        }

        this.activeToolName = toolName;

        // Resolve the interaction state from the registry
        const descriptor = getByToolName(toolName);
        if (descriptor) {
            this.activeState = descriptor.stateType === 'polygon'
                ? new PolygonMeasurementState(toolName, this.eventBus)
                : new PointMeasurementState(toolName, this.eventBus);
        } else {
            this.activeState = new IdleState(this.eventBus);
        }

        this.interactionController.setState(this.activeState);
        this.activeState.onEnter(this.interactionController);

        this.logger.info(`ToolController: Active tool changed to "${this.activeToolName}".`);
        this.eventBus.emit('tool:changed', { activeTool: this.activeToolName });
    }
}
