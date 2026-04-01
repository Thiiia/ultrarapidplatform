using UnityEngine;

public class NotesPerimeterHitHandler : MonoBehaviour
{
	private void OnTriggerEnter(Collider collision)
	{
		if (collision.CompareTag("Note"))
		{
			Destroy(collision.gameObject);
		}
	}
}
