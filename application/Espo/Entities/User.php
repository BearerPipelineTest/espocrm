<?php

namespace Espo\Entities;

class User extends \Espo\ORM\Entity
{
	public function isAdmin()
	{
		return $this->get('isAdmin');
	} 
	
	public function getName()
	{
		return $this->get('firstName') . ' ' . $this->get('lastName');
	}
}
