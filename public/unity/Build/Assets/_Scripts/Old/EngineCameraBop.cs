using UnityEngine;
using DG.Tweening;

public class EngineCameraOrbiter : MonoBehaviour
{
    public Transform orbitTarget; // Assign the engine root
    public float orbitRadius = 6f;
    public float orbitHeight = 2f;
    public float rotationSpeed = 30f; // Degrees per beat
    public float zoomPulse = 0.5f;
    public float cameraMoveDuration = 0.4f;

    private float currentAngle = 0f;

    void Start()
    {
        if (orbitTarget == null)
        {
            Debug.LogError("No orbit target assigned to EngineCameraOrbiter.");
            return;
        }

        ChartSystem.OnBeat += RotateAroundEngine;
    }

    void OnDestroy()
    {
        ChartSystem.OnBeat -= RotateAroundEngine;
    }

    void RotateAroundEngine()
    {
        currentAngle += rotationSpeed;

        // Convert angle to radians
        float angleRad = currentAngle * Mathf.Deg2Rad;

        // Calculate new position
        Vector3 offset = new Vector3(
            Mathf.Cos(angleRad) * orbitRadius,
            orbitHeight + Random.Range(-0.2f, 0.2f), // adds some vertical drift
            Mathf.Sin(angleRad) * orbitRadius
        );

        Vector3 targetPos = orbitTarget.position + offset;

        // Move camera smoothly
        transform.DOMove(targetPos, cameraMoveDuration).SetEase(Ease.InOutSine);
        transform.DOLookAt(orbitTarget.position, cameraMoveDuration);
    }
}
