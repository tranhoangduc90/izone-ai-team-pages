import '../shared/desktop-exam-guard.js';
if(!window.IZONE_EXAM_DEVICE_BLOCKED){const {mountNativeShell}=await import('./native-shell.mjs?v=20261117-start-scroll-v1');mountNativeShell();await import('./writing-controller.mjs?v=20261117-start-scroll-v1');}
