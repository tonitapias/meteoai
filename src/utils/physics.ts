// src/utils/physics.ts
// PONT TÀCTIC: Aquest arxiu es recrea exclusivament com a "Proxy" de retrocompatibilitat.
// Redirigeix les peticions de la resta del codi cap al nou motor central blindat.

export {
    extractValidNum,
    safeNum,
    getShiftedDate,
    calculateDewPoint,
    getMoonPhase,
    isAromeSupported,
    calculateReliability
} from './weatherMath';