using UnityEngine;

[CreateAssetMenu(fileName = "LaneOffsetConfig", menuName = "ULTRARAPID/Lane Offset Config", order = 0)]
public class LaneOffsetConfig : ScriptableObject
{
        [Header("Serialized lane offsets")] 
        [SerializeField]
        private float[] horizontalLaneOffsets = new float[] { -2f, -0.5f, 1f, 2.5f, 4f };

        [SerializeField]
        private float[] verticalLaneOffsets = new float[] { -0.96f, -2.4f, -3.93f, -5.4f, -6.93f };

        [SerializeField]
        private float[] guitarHeroLaneOffsets = new float[] { 4.08f, 2.55f, 1.02f, -0.562f, -2.15f };

        public float[] HorizontalLaneOffsets => horizontalLaneOffsets;
        public float[] VerticalLaneOffsets => verticalLaneOffsets;
        public float[] GuitarHeroLaneOffsets => guitarHeroLaneOffsets;
}
