import '../shared/desktop-exam-guard.js';
if(!window.IZONE_EXAM_DEVICE_BLOCKED){const {mountNativeShell}=await import('./native-shell.mjs?v=20261118-parity12-v1');mountNativeShell();await import('./writing-controller.mjs?v=registration-live-20261120-r4');}
