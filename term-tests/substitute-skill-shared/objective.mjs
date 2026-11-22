import '../shared/desktop-exam-guard.js';
import '../shared/cbt-audio-start-label.js';
if(!window.IZONE_EXAM_DEVICE_BLOCKED){const {mountNativeShell}=await import('./native-shell.mjs?v=20261118-parity12-v1');mountNativeShell();await import('./objective-controller.mjs?v=roster-picker-20261122');}
