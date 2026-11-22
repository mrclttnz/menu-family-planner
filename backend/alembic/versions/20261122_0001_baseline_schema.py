"""baseline schema (S34, ADR-0001)

Schema of the app as of S33-prep: equivalent to Base.metadata.create_all + the legacy runtime
migrations (app/core/migrations.py). Existing databases are brought to this exact shape by
app.core.db_bootstrap before being stamped with this revision.

Revision ID: 0001
Revises: 
Create Date: 2026-11-22 18:08:51.952648
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '0001'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('dish_status_lookups',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('description', sa.String(length=255), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('is_system', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('dish_status_lookups', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dish_status_lookups_code'), ['code'], unique=True)
        batch_op.create_index(batch_op.f('ix_dish_status_lookups_id'), ['id'], unique=False)

    op.create_table('households',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('households', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_households_email'), ['email'], unique=True)
        batch_op.create_index(batch_op.f('ix_households_id'), ['id'], unique=False)

    op.create_table('meal_types',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=30), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('default_sort_order', sa.Integer(), nullable=False),
    sa.Column('is_default_active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('meal_types', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meal_types_code'), ['code'], unique=True)
        batch_op.create_index(batch_op.f('ix_meal_types_id'), ['id'], unique=False)

    op.create_table('course_types',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('course_types', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_course_types_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_course_types_id'), ['id'], unique=False)

    op.create_table('dish_statuses',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=False),
    sa.Column('status_lookup_id', sa.Integer(), nullable=False),
    sa.Column('custom_label', sa.String(length=100), nullable=True),
    sa.Column('color', sa.String(length=20), nullable=False),
    sa.Column('is_default', sa.Boolean(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['status_lookup_id'], ['dish_status_lookups.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('household_id', 'status_lookup_id', name='uq_household_status_lookup')
    )
    with op.batch_alter_table('dish_statuses', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dish_statuses_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_dish_statuses_id'), ['id'], unique=False)

    op.create_table('meal_slots',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('meal_type_id', sa.Integer(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['meal_type_id'], ['meal_types.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('household_id', 'date', 'meal_type_id', name='uq_household_date_meal_type')
    )
    with op.batch_alter_table('meal_slots', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meal_slots_date'), ['date'], unique=False)
        batch_op.create_index(batch_op.f('ix_meal_slots_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meal_slots_id'), ['id'], unique=False)

    op.create_table('members',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('avatar_color', sa.String(length=20), nullable=True),
    sa.Column('is_child', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('household_id', 'name', name='uq_household_member_name')
    )
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_members_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_members_id'), ['id'], unique=False)

    op.create_table('source_types',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('icon', sa.String(length=50), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('source_types', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_source_types_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_source_types_id'), ['id'], unique=False)

    op.create_table('tags',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('color', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('household_id', 'name', name='uq_household_tag_name')
    )
    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_tags_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_tags_id'), ['id'], unique=False)

    op.create_table('attendances',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=False),
    sa.Column('meal_slot_id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('is_attending', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['meal_slot_id'], ['meal_slots.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('meal_slot_id', 'member_id', name='uq_meal_slot_member_attendance')
    )
    with op.batch_alter_table('attendances', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_attendances_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendances_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendances_meal_slot_id'), ['meal_slot_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_attendances_member_id'), ['member_id'], unique=False)

    op.create_table('dishes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('household_id', sa.Integer(), nullable=False),
    sa.Column('status_id', sa.Integer(), nullable=False),
    sa.Column('source_type_id', sa.Integer(), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('source_reference', sa.String(length=255), nullable=True),
    sa.Column('source_url', sa.String(length=1000), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['source_type_id'], ['source_types.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['status_id'], ['dish_statuses.id'], ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('dishes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dishes_household_id'), ['household_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_dishes_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_dishes_status_id'), ['status_id'], unique=False)

    # Issue #17: case-insensitive, whitespace-trimmed unique title per household. Alembic's autogenerate
    # skips expression-based indexes, so it is declared by hand (it also lives in the Dish model).
    op.create_index(
        'uq_dishes_household_lower_title', 'dishes',
        ['household_id', sa.text('lower(trim(title))')], unique=True,
    )

    op.create_table('dish_courses',
    sa.Column('dish_id', sa.Integer(), nullable=False),
    sa.Column('course_type_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['course_type_id'], ['course_types.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['dish_id'], ['dishes.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('dish_id', 'course_type_id')
    )
    op.create_table('dish_member_preferences',
    sa.Column('dish_id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.String(length=20), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("rating IN ('favorite', 'neutral', 'dislike')", name='check_valid_preference_rating'),
    sa.ForeignKeyConstraint(['dish_id'], ['dishes.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('dish_id', 'member_id')
    )
    op.create_table('dish_tags',
    sa.Column('dish_id', sa.Integer(), nullable=False),
    sa.Column('tag_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['dish_id'], ['dishes.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('dish_id', 'tag_id')
    )
    op.create_table('meal_slot_dishes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('meal_slot_id', sa.Integer(), nullable=False),
    sa.Column('dish_id', sa.Integer(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('notes', sa.String(length=255), nullable=True),
    sa.ForeignKeyConstraint(['dish_id'], ['dishes.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['meal_slot_id'], ['meal_slots.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('meal_slot_id', 'dish_id', name='uq_meal_slot_dish')
    )
    with op.batch_alter_table('meal_slot_dishes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meal_slot_dishes_dish_id'), ['dish_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meal_slot_dishes_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meal_slot_dishes_meal_slot_id'), ['meal_slot_id'], unique=False)

    op.create_table('meal_slot_dish_members',
    sa.Column('meal_slot_dish_id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['meal_slot_dish_id'], ['meal_slot_dishes.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('meal_slot_dish_id', 'member_id')
    )
    op.create_table('meal_slot_dish_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('meal_slot_dish_id', sa.Integer(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['meal_slot_dish_id'], ['meal_slot_dishes.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('meal_slot_dish_notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meal_slot_dish_notes_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meal_slot_dish_notes_meal_slot_dish_id'), ['meal_slot_dish_id'], unique=False)

    op.create_table('meal_slot_dish_ratings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('meal_slot_dish_id', sa.Integer(), nullable=False),
    sa.Column('member_id', sa.Integer(), nullable=False),
    sa.Column('rating', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['meal_slot_dish_id'], ['meal_slot_dishes.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('meal_slot_dish_id', 'member_id', name='uq_slot_dish_member_rating')
    )
    with op.batch_alter_table('meal_slot_dish_ratings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meal_slot_dish_ratings_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meal_slot_dish_ratings_meal_slot_dish_id'), ['meal_slot_dish_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_meal_slot_dish_ratings_member_id'), ['member_id'], unique=False)



def downgrade() -> None:
    with op.batch_alter_table('meal_slot_dish_ratings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meal_slot_dish_ratings_member_id'))
        batch_op.drop_index(batch_op.f('ix_meal_slot_dish_ratings_meal_slot_dish_id'))
        batch_op.drop_index(batch_op.f('ix_meal_slot_dish_ratings_id'))

    op.drop_table('meal_slot_dish_ratings')
    with op.batch_alter_table('meal_slot_dish_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meal_slot_dish_notes_meal_slot_dish_id'))
        batch_op.drop_index(batch_op.f('ix_meal_slot_dish_notes_id'))

    op.drop_table('meal_slot_dish_notes')
    op.drop_table('meal_slot_dish_members')
    with op.batch_alter_table('meal_slot_dishes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meal_slot_dishes_meal_slot_id'))
        batch_op.drop_index(batch_op.f('ix_meal_slot_dishes_id'))
        batch_op.drop_index(batch_op.f('ix_meal_slot_dishes_dish_id'))

    op.drop_table('meal_slot_dishes')
    op.drop_table('dish_tags')
    op.drop_table('dish_member_preferences')
    op.drop_table('dish_courses')
    op.drop_index('uq_dishes_household_lower_title', table_name='dishes')
    with op.batch_alter_table('dishes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dishes_status_id'))
        batch_op.drop_index(batch_op.f('ix_dishes_id'))
        batch_op.drop_index(batch_op.f('ix_dishes_household_id'))

    op.drop_table('dishes')
    with op.batch_alter_table('attendances', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_attendances_member_id'))
        batch_op.drop_index(batch_op.f('ix_attendances_meal_slot_id'))
        batch_op.drop_index(batch_op.f('ix_attendances_id'))
        batch_op.drop_index(batch_op.f('ix_attendances_household_id'))

    op.drop_table('attendances')
    with op.batch_alter_table('tags', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_tags_id'))
        batch_op.drop_index(batch_op.f('ix_tags_household_id'))

    op.drop_table('tags')
    with op.batch_alter_table('source_types', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_source_types_id'))
        batch_op.drop_index(batch_op.f('ix_source_types_household_id'))

    op.drop_table('source_types')
    with op.batch_alter_table('members', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_members_id'))
        batch_op.drop_index(batch_op.f('ix_members_household_id'))

    op.drop_table('members')
    with op.batch_alter_table('meal_slots', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meal_slots_id'))
        batch_op.drop_index(batch_op.f('ix_meal_slots_household_id'))
        batch_op.drop_index(batch_op.f('ix_meal_slots_date'))

    op.drop_table('meal_slots')
    with op.batch_alter_table('dish_statuses', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dish_statuses_id'))
        batch_op.drop_index(batch_op.f('ix_dish_statuses_household_id'))

    op.drop_table('dish_statuses')
    with op.batch_alter_table('course_types', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_course_types_id'))
        batch_op.drop_index(batch_op.f('ix_course_types_household_id'))

    op.drop_table('course_types')
    with op.batch_alter_table('meal_types', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_meal_types_id'))
        batch_op.drop_index(batch_op.f('ix_meal_types_code'))

    op.drop_table('meal_types')
    with op.batch_alter_table('households', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_households_id'))
        batch_op.drop_index(batch_op.f('ix_households_email'))

    op.drop_table('households')
    with op.batch_alter_table('dish_status_lookups', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dish_status_lookups_id'))
        batch_op.drop_index(batch_op.f('ix_dish_status_lookups_code'))

    op.drop_table('dish_status_lookups')
