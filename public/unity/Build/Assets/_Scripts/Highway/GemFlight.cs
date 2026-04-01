using UnityEngine;
using DG.Tweening;

public static class GemFlight
{
    public static void FlyToWorldTarget(
        Canvas canvas, Camera cam, GameObject uiPrefab,
        Vector3 worldStart, Vector3 worldTarget, float duration = 0.6f,
        bool targetIsUIWorld = false)
    {
        if (!canvas || !uiPrefab || cam == null) return;

        var ui = Object.Instantiate(uiPrefab, canvas.transform);
        var rect = ui.GetComponent<RectTransform>();
        var canvasRect = canvas.GetComponent<RectTransform>();
        var effectiveCam = canvas.renderMode == RenderMode.ScreenSpaceCamera ? (canvas.worldCamera ?? cam) : null;
        // Normalize anchors/pivot to avoid offsets from prefab settings
        if (rect)
        {
            rect.anchorMin = rect.anchorMax = new Vector2(0.5f, 0.5f);
            rect.pivot = new Vector2(0.5f, 0.5f);
        }

        // Convert worldStart (3D world) to Canvas local point
        var startScreen3 = cam.WorldToScreenPoint(worldStart);
        if (startScreen3.z <= 0f) { Object.Destroy(ui); return; }
        var startScreen = (Vector2)startScreen3;
        if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
            canvasRect,
            startScreen,
            effectiveCam,
            out var startLocal
        ))
        {
            Object.Destroy(ui);
            return;
        }
        rect.anchoredPosition = startLocal;

        // Convert worldTarget:
        // - if target is from UI world space (e.g., DiagramManager tip), project with UI camera
        // - otherwise project with the world camera
        var camForEnd = targetIsUIWorld ? effectiveCam : cam;
        Vector2 endScreen;
        if (camForEnd != null)
        {
            var endScreen3 = camForEnd.WorldToScreenPoint(worldTarget);
            if (endScreen3.z <= 0f) { Object.Destroy(ui); return; }
            endScreen = (Vector2)endScreen3;
        }
        else
        {
            // Overlay canvas: use RectTransformUtility helper
            endScreen = RectTransformUtility.WorldToScreenPoint(null, worldTarget);
        }

        // end (Canvas local point)
        if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
            canvasRect,
            endScreen,
            effectiveCam,
            out var endLocal
        ))
        {
            Object.Destroy(ui);
            return;
        }

        // flight
        rect.localScale = Vector3.one;
        var seq = DOTween.Sequence()
            .Join(rect.DOAnchorPos(endLocal, duration).SetEase(Ease.InQuad))
            .Join(rect.DOScale(0.85f, duration))
            .SetUpdate(true)
            .OnComplete(() => Object.Destroy(ui))
            .OnKill(() => { if (ui) Object.Destroy(ui); });

        // Failsafe: ensure cleanup even if something pauses/kills the tween without completion
        DOVirtual.DelayedCall(duration + 1.0f, () => { if (ui) Object.Destroy(ui); }, ignoreTimeScale: true);
    }
}
