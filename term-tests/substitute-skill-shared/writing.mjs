import '../shared/desktop-exam-guard.js';
if(!window.IZONE_EXAM_DEVICE_BLOCKED){const {mountNativeShell}=await import('./native-shell.mjs');mountNativeShell();await import('./writing-controller.mjs');}
