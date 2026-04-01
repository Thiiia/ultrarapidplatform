// Copyright (c) Le Loc Tai <leloctai.com> . All rights reserved. Do not redistribute.

using System.Diagnostics.CodeAnalysis;
using System.Text;
using UnityEditor;
using UnityEngine;

namespace LeTai.Asset.Paraform.Editor
{
[SuppressMessage("ReSharper", "Unity.PreferAddressByIdToGraphicsParams")]
public static class Migration
{
    const string SHADER_NAME = "UI/TranslucentImage-Paraform";

    [MenuItem("Tools/Translucent Image/Migrate Paraform Materials", false, 10000)]
    static void MigrateMaterial()
    {
        var guids = AssetDatabase.FindAssets("t:Material");
        var count = 0;

        var log = new StringBuilder();

        foreach (var guid in guids)
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var mat  = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (TryMigrate(mat))
            {
                log.AppendLine($"{mat.name}\t{path}");
                count++;
            }
        }

        if (count <= 0)
            return;

        AssetDatabase.SaveAssets();
        log.Insert(0, $"Migrated {count} material(s):\n\n");
        Debug.Log(log.ToString());
    }

    internal static bool TryMigrate(Material mat)
    {
        const string propEdgeGlint1Strength = "_EdgeGlint1Strength";
        const string propEdgeGlint2Strength = "_EdgeGlint2Strength";
        const string propEdgeGlint1Color    = "_EdgeGlint1Color";
        const string propEdgeGlint2Color    = "_EdgeGlint2Color";
        const float  migratedSentinel       = -1f;

        Color edgeGlint1ColorDefault = new(.25f, .25f, .25f, 1f);
        Color edgeGlint2ColorDefault = new(.1f, .1f, .1f, 1f);

        if (!mat.shader || mat.shader.name != SHADER_NAME)
            return false;

        if (!mat.HasProperty(propEdgeGlint1Strength)
         || !mat.HasProperty(propEdgeGlint2Strength)
         || !mat.HasProperty(propEdgeGlint1Color)
         || !mat.HasProperty(propEdgeGlint2Color))
            return false;

        var edgeGlint1Strength = mat.GetFloat(propEdgeGlint1Strength);
        var edgeGlint2Strength = mat.GetFloat(propEdgeGlint2Strength);
        var edgeGlint1Color    = mat.GetColor(propEdgeGlint1Color);
        var edgeGlint2Color    = mat.GetColor(propEdgeGlint2Color);

        bool alreadyMigrated1 = edgeGlint1Strength < 0f;
        bool alreadyMigrated2 = edgeGlint2Strength < 0f;

        bool shouldMigrate1 = !alreadyMigrated1
                           && IsClose(edgeGlint1Color, edgeGlint1ColorDefault)
                           && !IsClose(edgeGlint1Color, Grayscale(edgeGlint1Strength));
        bool shouldMigrate2 = !alreadyMigrated2
                           && IsClose(edgeGlint2Color, edgeGlint2ColorDefault)
                           && !IsClose(edgeGlint2Color, Grayscale(edgeGlint2Strength));

        if (!shouldMigrate1 && !shouldMigrate2)
            return false;

        if (shouldMigrate1)
        {
            mat.SetColor(propEdgeGlint1Color, Grayscale(edgeGlint1Strength));
            mat.SetFloat(propEdgeGlint1Strength, migratedSentinel);
        }
        if (shouldMigrate2)
        {
            mat.SetColor(propEdgeGlint2Color, Grayscale(edgeGlint2Strength));
            mat.SetFloat(propEdgeGlint2Strength, migratedSentinel);
        }

        EditorUtility.SetDirty(mat);
        return true;
    }

    static Color Grayscale(float value)
    {
        return new Color(value, value, value, 1f);
    }

    static bool IsClose(Color a, Color b)
    {
        return Mathf.Abs(a.r - b.r) < 1e-5f
            && Mathf.Abs(a.g - b.g) < 1e-5f
            && Mathf.Abs(a.b - b.b) < 1e-5f
            && Mathf.Abs(a.a - b.a) < 1e-5f;
    }
}
}
