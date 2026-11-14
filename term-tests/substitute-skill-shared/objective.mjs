import '../shared/desktop-exam-guard.js';
import '../shared/cbt-audio-start-label.js';
if(!window.IZONE_EXAM_DEVICE_BLOCKED){const {mountNativeShell}=await import('./native-shell.mjs');mountNativeShell();await import('./objective-controller.mjs');}
