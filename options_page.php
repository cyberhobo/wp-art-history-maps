<?php
/** 
 * Create the Open Context Attach options page.
 * 
 * @package OpenContextAttach
 */
?>
<div>
	<form action="options.php" method="post">
		<?php settings_fields( 'ocattach_options' ); ?>
		<?php do_settings_sections( 'open-context-attach-settings' ); ?>
		<input name="submit" type="submit" value="<?php esc_attr_e('Save Changes'); ?>" />
	</form>
</div>
