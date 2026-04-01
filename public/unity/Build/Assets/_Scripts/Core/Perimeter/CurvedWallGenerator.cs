using System.Collections.Generic;

using UnityEngine;

[RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
public class CurvedWallGenerator : MonoBehaviour
{
	[Header("Wall Shape")]
	[Tooltip("Radius from pivot (inner edge) to inner surface.")]
	public float innerRadius = 2f;
	[Tooltip("Thickness of the wall (outward).")]
	public float thickness = 0.3f;
	[Tooltip("Height of the wall.")]
	public float height = 2f;
	[Tooltip("Arc length in degrees.")]
	[Range(1f, 360f)] public float arcDegrees = 90f;
	[Tooltip("Number of segments along the arc.")]
	[Range(2, 256)] public int segments = 24;

	[Header("Collider")]
	public bool generateCollider = true;
	public bool colliderConvex = false;
	private MeshFilter meshFilter;
	private MeshCollider meshCollider;
	private Mesh mesh;
	private bool meshInitialized;

	public void InitializeCurvedWall()
	{
		arcDegrees = 0f;
		CacheComponents();
	}

#if UNITY_EDITOR
	private void OnValidate()
	{
		CacheComponents();

		UnityEditor.EditorApplication.delayCall += () =>
		{
			if (this == null)
			{
				return;
			}

			GenerateMesh(false);
		};
	}
#endif

	public void SetInnerRadiusAndHeight(float radius, float wallHeight)
	{
		innerRadius = radius;
		transform.localPosition = new Vector3(-radius, 0f, 0f);
		height = wallHeight;
	}

	public void SetArcDegrees(float arcLengthDelta)
	{
		if (innerRadius <= 0f)
		{
			return;
		}

		// Convert world-space arc length to degrees: angleDeg = (length / radius) * Rad2Deg
		float deltaDegrees = (arcLengthDelta / innerRadius) * Mathf.Rad2Deg;
		arcDegrees = Mathf.Clamp(arcDegrees + deltaDegrees, 1f, 360f);
		GenerateMesh(true);
	}

	private void GenerateMesh(bool isRuntime)
	{
		CacheComponents();

		if (mesh == null)
		{
			mesh = new Mesh { name = isRuntime ? "CurvedWall_Runtime" : "CurvedWall" };
		}

		mesh.Clear();
		mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;

		float outerRadius = innerRadius + thickness;
		float step = Mathf.Deg2Rad * (arcDegrees / segments);
		float halfH = height * 0.5f;

		var verts = new List<Vector3>();
		var normals = new List<Vector3>();
		var uvs = new List<Vector2>();
		var tris = new List<int>();

		Vector3[,] ring = new Vector3[segments + 1, 4];

		for (int i = 0; i <= segments; i++)
		{
			float angle = step * i;
			float cos = Mathf.Cos(angle);
			float sin = Mathf.Sin(angle);

			Vector3 innerBottom = new(innerRadius * cos, -halfH, innerRadius * sin);
			Vector3 outerBottom = new(outerRadius * cos, -halfH, outerRadius * sin);
			Vector3 innerTop = new(innerRadius * cos, halfH, innerRadius * sin);
			Vector3 outerTop = new(outerRadius * cos, halfH, outerRadius * sin);

			ring[i, 0] = innerBottom;
			ring[i, 1] = outerBottom;
			ring[i, 2] = innerTop;
			ring[i, 3] = outerTop;
		}

		void AddQuad(Vector3 a, Vector3 b, Vector3 c, Vector3 d, bool flip = false)
		{
			int start = verts.Count;
			verts.Add(a); verts.Add(b); verts.Add(c); verts.Add(d);
			Vector3 n = Vector3.Cross(b - a, d - a).normalized;
			normals.AddRange(new[] { n, n, n, n });

			uvs.AddRange(new[]
			{
				new Vector2(0,0), new Vector2(1,0),
				new Vector2(1,1), new Vector2(0,1)
			});

			if (!flip)
			{
				tris.AddRange(new[] { start, start + 1, start + 2, start, start + 2, start + 3 });
			}
			else
			{
				tris.AddRange(new[] { start, start + 2, start + 1, start, start + 3, start + 2 });
			}
		}

		for (int i = 0; i < segments; i++)
		{
			AddQuad(ring[i, 1], ring[i + 1, 1], ring[i + 1, 3], ring[i, 3]);
			AddQuad(ring[i + 1, 0], ring[i, 0], ring[i, 2], ring[i + 1, 2]);
			AddQuad(ring[i, 2], ring[i + 1, 2], ring[i + 1, 3], ring[i, 3]);
			AddQuad(ring[i + 1, 0], ring[i, 0], ring[i, 1], ring[i + 1, 1], true);
		}

		AddQuad(ring[0, 0], ring[0, 2], ring[0, 3], ring[0, 1]);
		AddQuad(ring[segments, 1], ring[segments, 3], ring[segments, 2], ring[segments, 0]);

		mesh.SetVertices(verts);
		mesh.SetNormals(normals);
		mesh.SetUVs(0, uvs);
		mesh.SetTriangles(tris, 0);

		mesh.RecalculateNormals();
		mesh.RecalculateBounds();
		mesh.RecalculateTangents();

		if (!meshInitialized)
		{
			mesh.MarkDynamic();
			meshInitialized = true;
		}

		meshFilter.sharedMesh = mesh;

		if (generateCollider)
		{
			if (meshCollider == null)
			{
				meshCollider = gameObject.GetComponent<MeshCollider>() ?? gameObject.AddComponent<MeshCollider>();
			}

			meshCollider.sharedMesh = null;
			meshCollider.sharedMesh = mesh;
			meshCollider.convex = colliderConvex;
		}
	}

	private void CacheComponents()
	{
		if (!meshFilter)
		{
			meshFilter = GetComponent<MeshFilter>();
		}

		if (generateCollider && !meshCollider)
		{
			meshCollider = gameObject.GetComponent<MeshCollider>() ?? gameObject.AddComponent<MeshCollider>();
		}
	}
}
