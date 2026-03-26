"use strict";
/**
 * Authenta SDK – manual integration test
 *
 * Two modes:
 *   1. Single function  — client.faceIntelligence()  handles everything in one call
 *   2. Step by step     — createMedia → upload → waitForMedia → getResult manually
 *
 * Flip the TEST flags to choose what to run, then:
 *   npx ts-node __tests__/client.test.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var src_1 = require("../src");
// ─── SDK setup ───────────────────────────────────────────────────────────────
var client = new src_1.AuthentaClient({
    baseUrl: 'https://platform.authenta.ai',
    clientId: '<CLIENT_ID>',
    clientSecret: '<CLIENT_SECRET>'
});
// ─── File paths ───────────────────────────────────────────────────────────────
var VIDEO_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/faceswap/real/1.mp4';
var IMAGE_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_live_images/real/1.jpg';
var REF_URI = 'file:///Volumes/Software/authenta-reactnative-sdk/data_samples/face_similiar/person_1/B.jpeg';
// ─── Toggle which tests to run ────────────────────────────────────────────────
var TEST = {
    // ── Single function ──────────────────────────────────────────────────────
    single: {
        fi1: true,
        df1: false,
        ac1: false,
        fi1_liveness: true,
        fi1_faceswap: false,
        fi1_similarity: false
    },
    // ── Step by step ─────────────────────────────────────────────────────────
    steps: {
        df1: false,
        ac1: false,
        fi1_liveness: false,
        fi1_faceswap: false,
        fi1_similarity: false
    }
};
// ═══════════════════════════════════════════════════════════════════════════════
// 1. SINGLE FUNCTION  —  client.faceIntelligence() does upload + poll + result in one call
// ═══════════════════════════════════════════════════════════════════════════════
function singleFunctionTests() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    return __awaiter(this, void 0, void 0, function () {
        var result, result, result, result, result, result;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    console.log('\n╔══════════════════════════════════════╗');
                    console.log('║       SINGLE FUNCTION: client.faceIntelligence()  ║');
                    console.log('╚══════════════════════════════════════╝');
                    if (!TEST.single.df1) return [3 /*break*/, 2];
                    console.log('\n── DF-1: Deepfake detection ─────────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(VIDEO_URI, 'DF-1')];
                case 1:
                    result = _k.sent();
                    console.log('mid    :', result.mid);
                    console.log('status :', result.status);
                    console.log('resultType :', (_a = result.result) === null || _a === void 0 ? void 0 : _a.resultType);
                    console.log('identityPredictions :', (_b = result.result) === null || _b === void 0 ? void 0 : _b.identityPredictions);
                    console.log('boundingBoxes :', (_c = result.result) === null || _c === void 0 ? void 0 : _c.boundingBoxes);
                    _k.label = 2;
                case 2:
                    if (!TEST.single.ac1) return [3 /*break*/, 4];
                    console.log('\n── AC-1: AI-generated image check ──────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(IMAGE_URI, 'AC-1')];
                case 3:
                    result = _k.sent();
                    console.log('mid    :', result.mid);
                    console.log('status :', result.status);
                    console.log('result :', (_d = result.result) === null || _d === void 0 ? void 0 : _d.RealConfidencePercent);
                    console.log('isAI   :', (_e = result.result) === null || _e === void 0 ? void 0 : _e.isDeepFake);
                    _k.label = 4;
                case 4:
                    if (!TEST.single.fi1) return [3 /*break*/, 6];
                    console.log('\n── FI-1: Face Intelligence check (liveness, faceswap, similarity) ──');
                    return [4 /*yield*/, client.faceIntelligence(IMAGE_URI, 'FI-1', {
                            livenessCheck: TEST.single.fi1_liveness,
                            faceswapCheck: TEST.single.fi1_faceswap,
                            faceSimilarityCheck: TEST.single.fi1_similarity,
                            referenceImage: TEST.single.fi1_similarity ? REF_URI : undefined
                        })];
                case 5:
                    result = _k.sent();
                    console.log('mid    :', result.mid);
                    console.log('status :', result.status);
                    console.log('result :', result.result);
                    _k.label = 6;
                case 6:
                    if (!TEST.single.fi1_liveness) return [3 /*break*/, 8];
                    console.log('\n── FI-1: Liveness check ─────────────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(IMAGE_URI, 'FI-1', {
                            livenessCheck: true
                        })];
                case 7:
                    result = _k.sent();
                    console.log('mid        :', result.mid);
                    console.log('status     :', result.status);
                    console.log('isLiveness :', (_f = result.result) === null || _f === void 0 ? void 0 : _f.isLiveness);
                    _k.label = 8;
                case 8:
                    if (!TEST.single.fi1_faceswap) return [3 /*break*/, 10];
                    console.log('\n── FI-1: Faceswap check ─────────────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(VIDEO_URI, 'FI-1', {
                            faceswapCheck: true
                        })];
                case 9:
                    result = _k.sent();
                    console.log('mid        :', result.mid);
                    console.log('status     :', result.status);
                    console.log('isDeepFake :', (_g = result.result) === null || _g === void 0 ? void 0 : _g.isDeepFake);
                    _k.label = 10;
                case 10:
                    if (!TEST.single.fi1_similarity) return [3 /*break*/, 12];
                    console.log('\n── FI-1: Face similarity ────────────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(IMAGE_URI, 'FI-1', {
                            faceSimilarityCheck: true,
                            referenceImage: REF_URI
                        })];
                case 11:
                    result = _k.sent();
                    console.log('mid             :', result.mid);
                    console.log('status          :', result.status);
                    console.log('isSimilar       :', (_h = result.result) === null || _h === void 0 ? void 0 : _h.isSimilar);
                    console.log('similarityScore :', (_j = result.result) === null || _j === void 0 ? void 0 : _j.similarityScore);
                    _k.label = 12;
                case 12: return [2 /*return*/];
            }
        });
    });
}
// ═══════════════════════════════════════════════════════════════════════════════
// 2. STEP BY STEP  —  createMedia → upload → waitForMedia → getResult
//    Use this when you need control between steps, e.g. upload now, poll later.
// ═══════════════════════════════════════════════════════════════════════════════
function stepByStepTests() {
    return __awaiter(this, void 0, void 0, function () {
        var uploaded, media, result, uploaded, media, result, uploaded, media, result, uploaded, media, result, uploaded, media, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n╔══════════════════════════════════════════════════════════════╗');
                    console.log('║  STEP BY STEP: upload → waitForMedia → getResult            ║');
                    console.log('╚══════════════════════════════════════════════════════════════╝');
                    if (!TEST.steps.df1) return [3 /*break*/, 4];
                    console.log('\n── DF-1: step by step ───────────────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(VIDEO_URI, 'DF-1', { autoPolling: false })];
                case 1:
                    uploaded = _a.sent();
                    console.log('uploaded — mid    :', uploaded.mid);
                    console.log('uploaded — status :', uploaded.status);
                    return [4 /*yield*/, client.waitForMedia(uploaded.mid, { interval: 5000, timeout: 300000 })];
                case 2:
                    media = _a.sent();
                    console.log('processed — status :', media.status);
                    if (!media.resultURL) return [3 /*break*/, 4];
                    return [4 /*yield*/, client.getResult(media)];
                case 3:
                    result = _a.sent();
                    console.log('result :', result);
                    _a.label = 4;
                case 4:
                    if (!TEST.steps.ac1) return [3 /*break*/, 8];
                    console.log('\n── AC-1: step by step ───────────────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(IMAGE_URI, 'AC-1', { autoPolling: false })];
                case 5:
                    uploaded = _a.sent();
                    console.log('uploaded — mid    :', uploaded.mid);
                    return [4 /*yield*/, client.waitForMedia(uploaded.mid)];
                case 6:
                    media = _a.sent();
                    console.log('processed — status :', media.status);
                    if (!media.resultURL) return [3 /*break*/, 8];
                    return [4 /*yield*/, client.getResult(media)];
                case 7:
                    result = _a.sent();
                    console.log('result :', result);
                    _a.label = 8;
                case 8:
                    if (!TEST.steps.fi1_liveness) return [3 /*break*/, 12];
                    console.log('\n── FI-1 liveness: step by step ──────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(IMAGE_URI, 'FI-1', {
                            livenessCheck: true,
                            autoPolling: false
                        })];
                case 9:
                    uploaded = _a.sent();
                    console.log('uploaded — mid    :', uploaded.mid);
                    console.log('uploaded — status :', uploaded.status);
                    return [4 /*yield*/, client.waitForMedia(uploaded.mid)];
                case 10:
                    media = _a.sent();
                    console.log('processed — status :', media.status);
                    if (!media.resultURL) return [3 /*break*/, 12];
                    return [4 /*yield*/, client.getResult(media)];
                case 11:
                    result = _a.sent();
                    console.log('isLiveness :', result.isLiveness);
                    console.log('isDeepFake :', result.isDeepFake);
                    _a.label = 12;
                case 12:
                    if (!TEST.steps.fi1_faceswap) return [3 /*break*/, 16];
                    console.log('\n── FI-1 faceswap: step by step ──────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(VIDEO_URI, 'FI-1', {
                            faceswapCheck: true,
                            autoPolling: false
                        })];
                case 13:
                    uploaded = _a.sent();
                    console.log('uploaded — mid :', uploaded.mid);
                    return [4 /*yield*/, client.waitForMedia(uploaded.mid)];
                case 14:
                    media = _a.sent();
                    console.log('processed — status :', media.status);
                    if (!media.resultURL) return [3 /*break*/, 16];
                    return [4 /*yield*/, client.getResult(media)];
                case 15:
                    result = _a.sent();
                    console.log('isDeepFake :', result.isDeepFake);
                    _a.label = 16;
                case 16:
                    if (!TEST.steps.fi1_similarity) return [3 /*break*/, 20];
                    console.log('\n── FI-1 similarity: step by step ────────────────────────────');
                    return [4 /*yield*/, client.faceIntelligence(IMAGE_URI, 'FI-1', {
                            faceSimilarityCheck: true,
                            referenceImage: REF_URI,
                            autoPolling: false
                        })];
                case 17:
                    uploaded = _a.sent();
                    console.log('uploaded — mid    :', uploaded.mid);
                    console.log('uploaded — status :', uploaded.status);
                    return [4 /*yield*/, client.waitForMedia(uploaded.mid)];
                case 18:
                    media = _a.sent();
                    console.log('processed — status :', media.status);
                    if (!media.resultURL) return [3 /*break*/, 20];
                    return [4 /*yield*/, client.getResult(media)];
                case 19:
                    result = _a.sent();
                    console.log('isSimilar       :', result.isSimilar);
                    console.log('similarityScore :', result.similarityScore);
                    _a.label = 20;
                case 20: return [2 /*return*/];
            }
        });
    });
}
// ─── Run ─────────────────────────────────────────────────────────────────────
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var anySingle, anySteps;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    anySingle = Object.values(TEST.single).some(Boolean);
                    anySteps = Object.values(TEST.steps).some(Boolean);
                    if (!anySingle && !anySteps) {
                        console.log('No tests enabled. Flip a flag in the TEST object to run something.');
                        return [2 /*return*/];
                    }
                    if (!anySingle) return [3 /*break*/, 2];
                    return [4 /*yield*/, singleFunctionTests()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    if (!anySteps) return [3 /*break*/, 4];
                    return [4 /*yield*/, stepByStepTests()];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    console.log('\n✓ All selected tests completed.\n');
                    return [2 /*return*/];
            }
        });
    });
}
main()["catch"](function (err) {
    if (err instanceof src_1.AuthentaError) {
        console.error("\n[".concat(err.name, "] ").concat(err.message, " (code=").concat(err.code, ", status=").concat(err.statusCode, ")"));
    }
    else {
        console.error('\n', err);
    }
    process.exit(1);
});
