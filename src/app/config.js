// src/config.js
import Logger from '../utils/Logger.js';

// Níveis disponíveis: 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'
// Altere esta linha para controlar a verbosidade dos logs em toda a aplicação.
const DEBUG_LEVEL_NAME = 'DEBUG'; 

// ========================================================================
// NÃO EDITE ABAIXO DESTA LINHA A MENOS QUE SAIBA O QUE ESTÁ FAZENDO
// ========================================================================

/** Nível de log a ser exibido. Logs com nível mais baixo (e.g., TRACE) são mais detalhados. */
export const DEBUG_LEVEL = Logger.LEVELS[DEBUG_LEVEL_NAME] || Logger.LEVELS.INFO;

/** Ativa/desativa o monitoramento de performance (FPS, tempo de render) e o dashboard. */
export const PERFORMANCE_MONITORING = true;

/** Ativa/desativa helpers visuais de debug no Three.js (e.g., bounding boxes, eixos). */
export const VISUAL_DEBUG = false;
