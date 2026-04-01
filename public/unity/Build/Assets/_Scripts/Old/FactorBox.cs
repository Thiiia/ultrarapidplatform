using UnityEngine;
using Shapes;

public class FactorBox : MonoBehaviour
{
    public bool isRevealed = false;  // Tracks if the box is revealed
    public int factorValue;         // The factor this box represents
    public Transform parentBox;     // The parent box in the factor tree

    private void OnRenderObject()
    {
        if (parentBox != null)
        {
            using (Draw.Command(Camera.main))
            {
                Draw.LineGeometry = LineGeometry.Volumetric3D;
                Draw.ThicknessSpace = ThicknessSpace.Pixels;
                Draw.Thickness = 5f;
                Draw.Color = Color.white;

                // Draw a line from this box to the parent
                Draw.Line(transform.position, parentBox.position);
            }
        }
    }

    public void Reveal()
    {
        isRevealed = true;
        // Update visual (e.g., change color, scale, or add text)
        GetComponent<Renderer>().material.color = Color.green; // Example visual change
    }

    public void AddToStack()
    {
        // Logic for adding to the stack (e.g., progress bar or count)
    }
}
