#include "../../TranslucentImage/Resources/Shaders/TranslucentImage.hlsl"
#include "../../TranslucentImage/Resources/Shaders/packing.hlsl"
#include "optics.hlsl"
#include "shape.hlsl"

uniform half _LeTai_CanvasScaleFactor;

uniform half3 _RefractiveIndexRatios;

uniform half4 _EdgeGlintDirections;
uniform half4 _EdgeGlint1Color;
uniform half4 _EdgeGlint2Color;
uniform half  _EdgeGlintWrap;
uniform half  _EdgeGlintSharpness;

struct ParaformConfig
{
    half2 center;
    half2 extent;
    half4 radii;
    half  cornerCurvature;
    half  filletCurvature;
    half  bevelWidth;
    half  halfRingThickness;
    half  elevation;
};

void unpackVertexDataParaform(VertexInput i, inout VertexOutput o)
{
    float maxRadii = min(i.packedData3[0], i.packedData3[1]);

    FloatUnpacker upk0 = CreateUnpacker(i.packedData2[0], 10);
    FloatUnpacker upk1 = CreateUnpacker(i.packedData2[1], 10);
    FloatUnpacker upk2 = CreateUnpacker(i.packedData2[2], 15);
    FloatUnpacker upk3 = CreateUnpacker(i.packedData2[3], 15);

    o.transfer2 = i.packedData3;
    o.transfer3 = half4(
        DequeueNonNegative(upk0, maxRadii),
        DequeueNonNegative(upk0, maxRadii),
        DequeueNonNegative(upk0, maxRadii),
        DequeueNonNegative(upk1, maxRadii)
    );
    o.transfer4 = half4(
        Dequeue(upk1, 1.001, 8),
        Dequeue(upk1, 1.001, 8),
        DequeueNonNegative(upk2, maxRadii),
        DequeueNonNegative(upk2, 1000)
    );
    o.transfer5 = half(
        DequeueNonNegative(upk3, maxRadii)
    );
}

ParaformConfig createParaformConfig(VertexOutput vertex)
{
    ParaformConfig data;

    data.extent = vertex.transfer2.xy;
    data.center = vertex.transfer2.zw;

    data.radii = vertex.transfer3;

    data.cornerCurvature = vertex.transfer4.x;
    data.filletCurvature = vertex.transfer4.y;
    data.bevelWidth = vertex.transfer4.z;
    data.elevation = vertex.transfer4.w;

    data.halfRingThickness = vertex.transfer5.x;

    return data;
}

void shape(ParaformConfig config, out half alpha, out half zEdge, out half3 normal, out half normalXYLen)
{
    half  edgeDistance;
    half2 gradient;
    roundedBox(config.center, config.extent - config.halfRingThickness, config.radii - config.halfRingThickness, config.cornerCurvature, edgeDistance, gradient);

    if (config.halfRingThickness > 0)
        ringify(config.halfRingThickness, edgeDistance, gradient);

    half edgeFactor = 1. - saturate(-edgeDistance / config.bevelWidth);

    half2 normalEdge;
    edgeParams(edgeFactor, config.filletCurvature, zEdge, normalEdge);
    normal.z = -normalEdge.y;

    half2  gradientScreen;
    float2 dpdy = ddy(config.center);
    #if UNITY_UV_STARTS_AT_TOP
    dpdy *= -_ProjectionParams.x;
    #endif
    gradientScreen.y = dot(gradient, dpdy);
    gradientScreen.x = dot(gradient, ddx(config.center));

    half gradScreenLenRcp = rsqrtApprox01(dot(gradientScreen, gradientScreen));

    normal.xy = gradientScreen * gradScreenLenRcp * normalEdge.x;
    normalXYLen = normalEdge.x;

    half transitionWidth = sqrt(2);
    half distScale = (1. / transitionWidth) * gradScreenLenRcp;
    alpha = saturate(-edgeDistance * distScale);
}

half3 sampleRefractedBackground(float2 screenPos, half3 normal, half distance)
{
    half3 backgroundColor;
    #if _REFRACTION_MODE_OFF
    backgroundColor = sampleBackground(screenPos);
    #else
    #if _REFRACTION_MODE_ON
    half2 offset = GetRefractedScreenOffset(normal, distance, _RefractiveIndexRatios[0]);
    backgroundColor = sampleBackground(screenPos + offset);
    #elif _REFRACTION_MODE_CHROMATIC
    UNITY_UNROLL for (int i = 0; i < 3; ++i)
    {
        half2 offset = GetRefractedScreenOffset(normal, distance, _RefractiveIndexRatios[i]);
        backgroundColor[i] = sampleBackground(screenPos + offset)[i];
    }
    #endif
    #endif

    return backgroundColor;
}

half3 specular(half2 normalXY, half normalXYLen, half2 halfDir)
{
    half gterm = max(0, dot(normalXY, halfDir));
    half spec = pow(gterm, lerp(_EdgeGlintSharpness, _EdgeGlintWrap, normalXYLen));

    return spec;
}

half3 blendEdge(half3 color, half2 normalXY, half normalXYLen)
{
    #if _USE_EDGE_GLINT

    // halfdir.z = 0 work well
    half3 edgeGlint1 = specular(normalXY, normalXYLen, _EdgeGlintDirections.xy) * _EdgeGlint1Color.rgb;
    half3 edgeGlint2 = specular(normalXY, normalXYLen, _EdgeGlintDirections.zw) * _EdgeGlint2Color.rgb;

    color = saturate(color + edgeGlint1 + edgeGlint2);

    #endif

    return color;
}

half4 paraformMain(ParaformConfig config, float2 screenPos, half4 foregroundColor, Appearance appearance)
{
    half  shapeAlpha;
    half  zEdge;
    half3 normal;
    half  normalXYLen;
    shape(config, shapeAlpha, zEdge, normal, normalXYLen);

    #ifdef _BACKGROUND_MODE_OPAQUE
    half4 color = foregroundColor;
    #else
    half backgroundZDistance = zEdge * config.bevelWidth + config.elevation;
    backgroundZDistance *= _LeTai_CanvasScaleFactor;
    half3 backgroundColor = sampleRefractedBackground(screenPos, normal, backgroundZDistance);
    // half fresnelTerm = pow(1 - saturate(-normal.z), 5);
    // backgroundColor *= 1 - fresnelTerm;
    half4 color = blendBackground(foregroundColor, backgroundColor, appearance);
    #endif

    color.rgb = blendEdge(color.rgb, normal.xy, normalXYLen);
    color.a *= shapeAlpha;

    // color.rgb = backgroundColor;
    // color.rgb = 0;
    // color = float4(shapeAlpha.xxx, 1);
    // color.rgb = (normal + 1) / 2;
    // color.rgb = zEdge;
    // color.rgb = fresnelTerm;
    // color.rgb = blendEdge(0, normal.xy, normalXYLen);
    // color.rgb = normalXYLen;
    // half2 offset = GetRefractedScreenOffset(normal, backgroundZDistance, _RefractiveIndexRatios[0]);
    // color.rgb = sampleBackground(screenPos + offset);
    // color.rg = abs(offset);
    // color.rg = screenPos + offset;
    // color.b = 0;

    return color;
}

