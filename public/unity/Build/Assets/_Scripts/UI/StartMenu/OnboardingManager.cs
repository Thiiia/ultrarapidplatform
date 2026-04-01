using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class OnboardingManager : MonoBehaviour
{
	public int currentSlide { get; set; } = 0;
	public int totalSlides { get; set; } = 0;

	[SerializeField] private GameObject[] slideContainers;

	private void Update()
	{
		switch (currentSlide)
		{
			case 0:
				{

					return;
				}
			case 1:
				{
					if (currentSlide < slideContainers.Length)
					{
						slideContainers[currentSlide].SetActive(true);
					}

					break;
				}
			case 2:
				{
					if (currentSlide < slideContainers.Length)
					{
						slideContainers[currentSlide - 1].SetActive(false);
						slideContainers[currentSlide].SetActive(true);
					}

					break;
				}
			case 3:
				{
					if (currentSlide < slideContainers.Length)
					{
						slideContainers[currentSlide - 1].SetActive(false);
						slideContainers[currentSlide].SetActive(true);
					}

					break;
				}
			default:
				{

					break;
				}
		}
	}
}
