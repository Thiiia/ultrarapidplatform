using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class Carousel : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
{
    [SerializeField] private RectTransform[] carouselItems;
    [SerializeField] private Image[] carouselBar;
    [SerializeField] private Vector2 carouselItemActivatedScale = Vector2.one;
    [SerializeField] private Vector2 carouselItemDeactivatedScale = Vector2.one;
    [SerializeField] private Sprite carouselItemActivated;
    [SerializeField] private Sprite carouselItemDeactivated;
    [SerializeField] private float rotationSpeed = 20f;

    [Header("Layout")]
    [SerializeField] private float itemSpacing = 480f;
    [SerializeField] private float scalePerStep = 0.82f;
    [SerializeField] private float snapThreshold = 0.3f;

    private int currentIndex;
    private float dragOffset;
    private bool isDragging;

    private void OnValidate()
    {
        ApplyLayout();
        RefreshBar();
    }
    private void Start()
    {
        ApplyLayout();
        RefreshBar();
    }

    public void OnBeginDrag(PointerEventData eventData) => isDragging = true;

    public void OnDrag(PointerEventData eventData)
    {
        dragOffset += eventData.delta.x;
        ApplyLayout();
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        isDragging = false;
        float threshold = itemSpacing * snapThreshold;

        if (dragOffset > threshold)
        {
            currentIndex = Mathf.Max(currentIndex - 1, 0);
        }
        else if (dragOffset < -threshold)
        {
            currentIndex = Mathf.Min(currentIndex + 1, carouselItems.Length - 1);
        }

        dragOffset = 0f;
        RefreshBar();
    }

    private void Update()
    {
        if (isDragging)
        {
            return;
        }

        float dt = Time.deltaTime * rotationSpeed;

        for (int i = 0; i < carouselItems.Length; i++)
        {
            RectTransform item = carouselItems[i];
            float targetX = (i - currentIndex) * itemSpacing;
            float newX = Mathf.Lerp(item.anchoredPosition.x, targetX, dt);
            item.anchoredPosition = new Vector2(newX, item.anchoredPosition.y);
            item.localScale = Vector3.one * ScaleAt(newX);
        }

        RefreshSortOrder();
    }

    private void ApplyLayout()
    {
        for (int i = 0; i < carouselItems.Length; i++)
        {
            float xPos = (i - currentIndex) * itemSpacing + dragOffset;
            RectTransform item = carouselItems[i];
            item.anchoredPosition = new Vector2(xPos, item.anchoredPosition.y);
            item.localScale = Vector3.one * ScaleAt(xPos);
        }
        RefreshSortOrder();
    }

    private float ScaleAt(float xOffset)
    {
        float steps = Mathf.Abs(xOffset) / itemSpacing;
        return Mathf.Pow(scalePerStep, steps);
    }

    private void RefreshSortOrder()
    {
        int count = carouselItems.Length;
        int[] indices = new int[count];
        for (int i = 0; i < count; i++) indices[i] = i;

        System.Array.Sort(indices, (a, b) => Mathf.Abs(carouselItems[b].anchoredPosition.x).CompareTo(Mathf.Abs(carouselItems[a].anchoredPosition.x)));

        for (int rank = 0; rank < count; rank++)
        {
            carouselItems[indices[rank]].SetSiblingIndex(rank);
        }
    }

    private void RefreshBar()
    {
        for (int i = 0; i < carouselBar.Length; i++)
        {
            bool active = i == currentIndex;
            carouselBar[i].sprite = active ? carouselItemActivated : carouselItemDeactivated;
            carouselBar[i].rectTransform.sizeDelta = active ? carouselItemActivatedScale : carouselItemDeactivatedScale;
        }
    }
}